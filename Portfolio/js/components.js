window.PF = window.PF || {};

PF.Components = {
  _combos: {},

  toast(msg, kind) {
    const t = PF.Utils.$('toast');
    t.textContent = msg;
    t.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(t._tm);
    t._tm = setTimeout(() => t.className = 'toast', 4000);
  },

  setupCoinCombo(opts) {
    const { searchInputId, listId, selectedId, onSelect } = opts;
    const searchInput = PF.Utils.$(searchInputId);
    const listEl = PF.Utils.$(listId);
    const selectedEl = PF.Utils.$(selectedId);
    let activeIdx = -1;
    let currentMatches = [];

    function renderList(filter) {
      const q = (filter || '').toLowerCase().trim();
      const coins = PF.API.getCoins();
      let matches;
      if (!q) {
        matches = coins.slice(0, 8);
      } else {
        matches = coins.filter(c => {
          const n = (c.name || '').toLowerCase();
          const s = (c.symbol || '').toLowerCase();
          return n.includes(q) || s.includes(q);
        }).slice(0, 50);
      }
      currentMatches = matches;
      activeIdx = -1;
      if (!matches.length) {
        listEl.innerHTML = '<div class="combo-empty">Aucune crypto trouv\u00e9e. Utilisez \u00ab Ajouter une crypto personnalis\u00e9e \u00bb.</div>';
      } else {
        listEl.innerHTML = matches.map((c, i) =>
          `<div class="combo-item" data-idx="${i}" data-id="${PF.Utils.escapeHtml(c.id)}">
            ${c.image && PF.Utils.isSafeUrl(c.image) ? `<img src="${PF.Utils.escapeHtml(c.image)}" alt="" onerror="this.style.display='none'">` : `<span style="width:22px;height:22px;border-radius:50%;background:#243357;display:grid;place-items:center;font-size:11px">${PF.Utils.escapeHtml((c.symbol || '?')[0])}</span>`}
            <div class="ci-main"><div class="ci-name">${PF.Utils.escapeHtml(c.name)}</div><div class="ci-sym">${PF.Utils.escapeHtml(c.symbol)}</div></div>
            <div class="ci-price">${PF.Utils.money(c.price, PF.State.data.currency)}</div>
          </div>`
        ).join('');
        listEl.querySelectorAll('.combo-item').forEach(el => {
          el.addEventListener('mousedown', (e) => {
            e.preventDefault();
            selectMatch(parseInt(el.dataset.idx, 10));
          });
        });
      }
      listEl.classList.add('show');
    }

    function selectMatch(idx) {
      const c = currentMatches[idx];
      if (!c) return;
      searchInput.value = '';
      listEl.classList.remove('show');
      selectedEl.style.display = 'flex';
      selectedEl.innerHTML =
        `${c.image && PF.Utils.isSafeUrl(c.image) ? `<img src="${PF.Utils.escapeHtml(c.image)}" onerror="this.style.display='none'">` : ''}<span><b>${PF.Utils.escapeHtml(c.name)}</b> (${PF.Utils.escapeHtml(c.symbol)}) \u2014 ${PF.Utils.money(c.price, PF.State.data.currency)}</span> <a style="margin-left:auto;color:var(--muted);cursor:pointer" onclick="PF.Components._clearCombo('${PF.Utils.escapeHtml(searchInputId)}');return false">\u2715 Changer</a>`;
      selectedEl.dataset.coinId = c.id;
      if (onSelect) onSelect(c);
    }

    function showSelected() { return selectedEl.dataset.coinId || ''; }

    function clearSelection() {
      selectedEl.style.display = 'none';
      delete selectedEl.dataset.coinId;
      selectedEl.innerHTML = '';
    }

    searchInput.addEventListener('focus', () => renderList(searchInput.value));
    let _debounce;
    searchInput.addEventListener('input', () => {
      clearTimeout(_debounce);
      _debounce = setTimeout(() => renderList(searchInput.value), 100);
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, currentMatches.length - 1); highlight(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); highlight(); }
      else if (e.key === 'Enter') { if (activeIdx >= 0 && currentMatches[activeIdx]) { e.preventDefault(); selectMatch(activeIdx); } }
      else if (e.key === 'Escape') { listEl.classList.remove('show'); }
    });

    function highlight() {
      listEl.querySelectorAll('.combo-item').forEach((el, i) => el.classList.toggle('active', i === activeIdx));
      const act = listEl.querySelector('.combo-item.active');
      if (act) act.scrollIntoView({ block: 'nearest' });
    }

    document.addEventListener('click', (e) => {
      const combo = searchInput.closest('.combobox');
      if (combo && !e.target.closest('#' + combo.id)) listEl.classList.remove('show');
    });

    return { showSelected, clearSelection, getCoin: () => { const id = showSelected(); return PF.API.getCoins().find(c => c.id === id); } };
  },

  _clearCombo(inputId) {
    if (inputId === 'coinSearch' && PF.Components._combos.add) PF.Components._combos.add.clearSelection();
    if (inputId === 'alertSearch' && PF.Components._combos.alert) PF.Components._combos.alert.clearSelection();
    if (inputId === 'swapToSearch' && PF.Components._combos.swapTo) PF.Components._combos.swapTo.clearSelection();
  },

  _autoCalcSwapTo() {
    const qty = parseFloat(PF.Utils.$('qty').value) || 0;
    const srcPrice = parseFloat(PF.Utils.$('buyPrice').value) || 0;
    const dstPrice = parseFloat(PF.Utils.$('swapToPrice').value) || 0;
    if (qty > 0 && srcPrice > 0 && dstPrice > 0) {
      PF.Utils.$('swapToAmount').value = (qty * srcPrice / dstPrice).toFixed(8);
    }
  },

  renderCoinCombos() {
    if (PF.Components._combos.add) return;
    PF.Components._combos.add = PF.Components.setupCoinCombo({
      searchInputId: 'coinSearch', listId: 'coinList', selectedId: 'coinSelected',
      onSelect: (c) => { PF.Utils.$('buyPrice').value = c.price; }
    });
    PF.Components._combos.alert = PF.Components.setupCoinCombo({
      searchInputId: 'alertSearch', listId: 'alertList', selectedId: 'alertSelected',
      onSelect: (c) => { PF.Utils.$('alertTarget').value = c.price; }
    });
    PF.Components._combos.swapTo = PF.Components.setupCoinCombo({
      searchInputId: 'swapToSearch', listId: 'swapToList', selectedId: 'swapToSelected',
      onSelect: (c) => {
        PF.Utils.$('swapToPrice').value = c.price;
        PF.Components._autoCalcSwapTo();
      }
    });
  }
};
