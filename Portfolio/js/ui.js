window.PF = window.PF || {};

PF.UI = {
  toast(msg, kind) { PF.Components.toast(msg, kind); },

  showSkeletons(show) {
    const posBody = PF.Utils.$('posBody');
    const txBody = PF.Utils.$('txBody');
    const histBody = PF.Utils.$('histBody');
    const chartLegend = PF.Utils.$('chartLegend');

    if (show) {
      posBody.innerHTML = PF.UI._skeletonRows(5);
      txBody.innerHTML = PF.UI._skeletonRows(3, 'tx');
      histBody.innerHTML = PF.UI._skeletonRows(4, 'hist');
      if (chartLegend) chartLegend.innerHTML = PF.UI._skeletonLegend(6);
    }
  },

  _skeletonRows(count, type) {
    if (type === 'tx') {
      return Array(count).fill(0).map(() => `
        <tr class="skeleton-row">
          <td class="num"><div class="skeleton skeleton-label"></div></td>
          <td><div class="skeleton skeleton-value"></div></td>
          <td><div class="skeleton skeleton-pill"></div></td>
          <td class="num"><div class="skeleton skeleton-value"></div></td>
          <td class="num"><div class="skeleton skeleton-value"></div></td>
          <td class="num"><div class="skeleton skeleton-value"></div></td>
          <td class="num"><div class="skeleton skeleton-value short"></div></td>
          <td class="tx-meta"><div class="skeleton skeleton-value med"></div></td>
          <td class="num"><div class="skeleton skeleton-pill"></div></td>
        </tr>`).join('');
    }
    if (type === 'hist') {
      return Array(count).fill(0).map(() => `
        <tr class="skeleton-row">
          <td class="num"><div class="skeleton skeleton-label"></div></td>
          <td class="num"><div class="skeleton skeleton-value"></div></td>
          <td class="num"><div class="skeleton skeleton-value"></div></td>
          <td class="num"><div class="skeleton skeleton-value"></div></td>
          <td class="num"><div class="skeleton skeleton-pill"></div></td>
          <td class="num"><div class="skeleton skeleton-value"></div></td>
        </tr>`).join('');
    }
    return Array(count).fill(0).map(() => `
      <tr class="skeleton-row">
        <td><div class="coin"><div class="skeleton" style="width:26px;height:26px;border-radius:50%"></div><div><div class="skeleton skeleton-value med"></div><div class="skeleton skeleton-label short"></div></div></div></td>
        <td class="num"><div class="skeleton skeleton-value"></div></td>
        <td class="num"><div class="skeleton skeleton-pill"></div></td>
        <td class="num"><div class="skeleton skeleton-value"></div></td>
        <td class="num"><div class="skeleton skeleton-value"></div></td>
        <td class="num"><div class="skeleton skeleton-value"></div></td>
        <td class="num"><div class="skeleton skeleton-value"></div></td>
        <td class="num"><div class="skeleton skeleton-value"></div></td>
        <td class="num"><div class="skeleton skeleton-pill"></div></td>
        <td class="num"><div class="skeleton skeleton-pill"></div></td>
        <td class="num"><div class="skeleton skeleton-pill"></div></td>
      </tr>`).join('');
  },

  _skeletonLegend(count) {
    return Array(count).fill(0).map(() => `
      <div class="row skeleton-row">
        <span class="name"><span class="sw skeleton" style="width:12px;height:12px"></span><div class="skeleton skeleton-value med"></div></span>
        <span class="pct skeleton skeleton-value short"></span>
      </div>`).join('');
  },

  renderPositions(positions, priceMap, fxRate, txAgg) {
    const body = PF.Utils.$('posBody'), empty = PF.Utils.$('posEmpty');
    if (!positions.length) { body.innerHTML = ''; empty.style.display = 'block'; return; }
    empty.style.display = 'none';

    // Compute total portfolio value for allocation %
    let totalValue = 0;
    const plCache = [];
    for (let i = 0; i < positions.length; i++) {
      const pl = PF.Engine.computePositionPL(positions[i], priceMap, fxRate, txAgg);
      plCache.push(pl);
      totalValue += pl.currentValue;
    }

    let filtered = positions;
    const pq = (PF.State._posSearch || '').toLowerCase().trim();
    if (pq) {
      filtered = positions.filter(p =>
        (p.name || '').toLowerCase().includes(pq) ||
        (p.symbol || '').toLowerCase().includes(pq) ||
        (p.coinId || '').toLowerCase().includes(pq)
      );
    }

    const rows = filtered.map((p) => {
      const idx = positions.indexOf(p);
      const pl = plCache[idx];
      const alloc = totalValue > 0 ? (pl.currentValue / totalValue) * 100 : 0;
      const info = priceMap[p.coinId];
      const chg24h = info ? info.change24h : null;
      return { p, ...pl, qty: p.qty, buy: pl.invested / p.qty || 0, cur: pl.curPrice, value: pl.currentValue, alloc, chg24h };
    });

    const sortKey = PF.State.sortKey;
    const sortDir = PF.State.sortDir;
    rows.sort((a, b) => {
      let va, vb;
      if (sortKey === 'name') { va = (a.p.name || '').toLowerCase(); vb = (b.p.name || '').toLowerCase(); }
      else if (sortKey === 'chg24h') { va = a.chg24h; vb = b.chg24h; }
      else { va = a[sortKey] || 0; vb = b[sortKey] || 0; }
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return va < vb ? -sortDir : (va > vb ? sortDir : 0);
    });

    const currency = PF.State.data.currency;
    body.innerHTML = rows.map(r => {
      const { p, curPrice, invested, currentValue, realized, pl, ret, alloc, chg24h } = r;
      const cls = pl >= 0 ? 'pos' : 'neg';
      const info = priceMap[p.coinId];
      const img = info ? info.image : '';
      const sym = p.symbol;
      const name = p.name;
      const chgCls = chg24h != null ? (chg24h >= 0 ? 'pos' : 'neg') : '';
      const unrealized = currentValue - invested;
      const rCls = realized >= 0 ? 'pos' : 'neg';
      const uCls = unrealized >= 0 ? 'pos' : 'neg';
      return `<tr class="${pl < 0 ? 'loss' : ''}">
        <td><div class="coin">
          ${img && PF.Utils.isSafeUrl(img) ? `<img src="${PF.Utils.escapeHtml(img)}" alt="" onerror="this.style.display='none'">`
                : `<span style="width:26px;height:26px;border-radius:50%;background:#243357;display:grid;place-items:center;font-size:12px">${PF.Utils.escapeHtml((sym || '?')[0])}</span>`}
          <div><div>${PF.Utils.escapeHtml(name)}${p.manual ? ' <span class="sym">(perso)</span>' : ''}</div><div class="sym">${PF.Utils.escapeHtml(sym)}</div></div>
        </div></td>
        <td class="num">${PF.Utils.money(curPrice, currency)}</td>
        <td class="num ${chgCls}">${chg24h != null ? (chg24h >= 0 ? '+' : '') + PF.Utils.fmt(chg24h, 1) + ' %' : '<span style="color:var(--muted)">\u2014</span>'}</td>
        <td class="num">${PF.Utils.fmt(p.qty, p.qty < 1 ? 6 : 4)}</td>
        <td class="num"><b>${PF.Utils.money(currentValue, currency)}</b></td>
        <td class="num">${PF.Utils.money(PF.Engine.getBuyPrice(p, fxRate), currency)}</td>
        <td class="num ${rCls}">${realized !== 0 ? (realized >= 0 ? '+' : '') + PF.Utils.money(realized, currency) : '<span style="color:var(--muted)">\u2014</span>'}</td>
        <td class="num ${uCls}">${unrealized >= 0 ? '+' : ''}${PF.Utils.money(unrealized, currency)}</td>
        <td class="num" style="color:var(--muted)">${PF.Utils.fmt(alloc, 1)} %</td>
        <td class="num"><span class="pill ${cls}">${ret >= 0 ? '+' : ''}${PF.Utils.fmt(ret)} %</span></td>
        <td class="num" style="white-space:nowrap">
          <button class="btn sm ghost" onclick="PF.App.openSell('${PF.Utils.escapeJS(p.symbol)}')" title="Vendre">\uD83D\uDCB0 Vendre</button>
          <button class="btn sm danger" onclick="PF.App.removeAllTransactions('${PF.Utils.escapeJS(p.symbol)}')" title="Supprimer">\u2715</button>
        </td>
      </tr>`;
    }).join('');
  },

  renderSummary(positions, priceMap, fxRate, txAgg) {
    const summary = PF.Engine.computeSummary(positions, priceMap, fxRate, txAgg);
    const { invested, value, realized, pl, ret, grossLoss } = summary;
    const cls = pl >= 0 ? 'pos' : 'neg';
    const currency = PF.State.data.currency;
    PF.Utils.$('sumInvested').textContent = PF.Utils.money(invested, currency);
    PF.Utils.$('sumValue').textContent = PF.Utils.money(value, currency);
    PF.Utils.$('sumPL').textContent = (pl >= 0 ? '+' : '') + PF.Utils.money(pl, currency);
    PF.Utils.$('sumPL').className = 'value ' + cls;
    PF.Utils.$('sumPLdelta').textContent = invested > 0 ? `Investi ${PF.Utils.money(invested, currency)} \u00b7 r\u00e9alis\u00e9 ${PF.Utils.money(realized, currency)}` : '\u00a0';
    PF.Utils.$('sumReturn').textContent = (ret >= 0 ? '+' : '') + PF.Utils.fmt(ret) + ' %';
    PF.Utils.$('sumReturn').className = 'value ' + cls;
    PF.Utils.$('sumLoss').textContent = grossLoss < 0 ? `\u26A0 Pertes non r\u00e9alis\u00e9es : ${PF.Utils.money(grossLoss, currency)}` : 'Aucune position en perte \uD83C\uDF89';
    PF.Utils.$('sumLoss').className = 'delta ' + (grossLoss < 0 ? 'neg' : 'pos');

    // 24h change (basé sur CoinGecko)
    var chg24h = 0;
    var val24h = 0;
    for (var i = 0; i < positions.length; i++) {
      var p = positions[i];
      var info = priceMap[p.coinId];
      var chgPct = info ? info.change24h : null;
      if (chgPct == null || chgPct === 0) continue;
      var curVal = PF.Engine.computePositionPL(p, priceMap, fxRate, txAgg).currentValue;
      if (curVal <= 0) continue;
      chg24h += curVal * chgPct / (100 + chgPct);
      val24h += curVal;
    }
    var el24h = PF.Utils.$('sumValue24h');
    if (chg24h !== 0 && val24h > 0) {
      var pct24h = (chg24h / (val24h - chg24h)) * 100;
      var arrow = chg24h >= 0 ? '\u25B2' : '\u25BC';
      var cls24h = chg24h >= 0 ? 'pos' : 'neg';
      el24h.innerHTML = arrow + ' ' + (chg24h >= 0 ? '+' : '') + PF.Utils.money(chg24h, currency) + ' (' + (chg24h >= 0 ? '+' : '') + PF.Utils.fmt(pct24h) + ' %)';
      el24h.className = 'delta ' + cls24h;
    } else {
      el24h.innerHTML = '\u00a0';
      el24h.className = 'delta';
    }
  },

  renderTransactions(transactions, periodFilter) {
    const body = PF.Utils.$('txBody'), empty = PF.Utils.$('txEmpty');
    if (!transactions.length) { body.innerHTML = ''; empty.style.display = 'block'; PF.UI.renderTxPagination(0); return; }
    const inPeriod = (dateStr) => periodFilter === 'all' || String(dateStr || '').slice(0, 4) === periodFilter;
    const q = (PF.State._txSearch || '').toLowerCase().trim();
    const typeFilter = PF.State._txTypeFilter || 'all';
    const filtered = transactions
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => inPeriod(t.date))
      .filter(({ t }) => typeFilter === 'all' || t.type === typeFilter)
      .filter(({ t }) => {
        if (!q) return true;
        const tags = (t.tags || []).join(' ').toLowerCase();
        return (t.symbol || '').toLowerCase().includes(q) ||
          (t.type || '').toLowerCase().includes(q) ||
          (t.date || '').includes(q) ||
          String(t.price).includes(q) || String(t.amount).includes(q) ||
          (t.notes || '').toLowerCase().includes(q) ||
          tags.includes(q);
      })
      .sort((a, b) => a.t.date < b.t.date ? 1 : (a.t.date > b.t.date ? -1 : 0));

    const totalPages = Math.ceil(filtered.length / PF.State.PAGE_SIZE);
    let page = PF.State._txPage;
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    PF.State._txPage = page;
    const start = (page - 1) * PF.State.PAGE_SIZE;
    const pageItems = filtered.slice(start, start + PF.State.PAGE_SIZE);

    const currency = PF.State.data.currency;
    if (!filtered.length) {
      body.innerHTML = `<tr><td colspan="9" class="empty">Aucune transaction ne correspond.</td></tr>`;
      empty.style.display = 'none'; PF.UI.renderTxPagination(0); return;
    }
    empty.style.display = 'none';
    body.innerHTML = pageItems.map(({ t, i }) => {
      const total = t.price * t.amount;
      const typeColor = PF.State.TX_TYPE_COLORS[t.type] || 'neutral';
      const typeLabel = PF.State.TX_TYPE_LABELS[t.type] || t.type;
      const fees = t.fees || 0;
      const notes = t.notes || '';
      const tags = t.tags || [];
      const metaHtml = [];
      if (notes) metaHtml.push(`<span class="tx-note" title="${PF.Utils.escapeHtml(notes)}">${PF.Utils.escapeHtml(notes.length > 40 ? notes.slice(0,40)+'…' : notes)}</span>`);
      tags.forEach(tag => metaHtml.push(`<span class="tag">${PF.Utils.escapeHtml(tag)}</span>`));
      return `<tr>
        <td style="color:var(--muted)">${PF.Utils.fmtDate(t.date)}</td>
        <td><strong>${t.symbol}</strong></td>
        <td><span class="pill ${typeColor}">${typeLabel}</span></td>
        <td class="num">${PF.Utils.fmt(t.price, t.price < 1 ? 6 : 2)}</td>
        <td class="num">${PF.Utils.fmt(t.amount, t.amount < 1 ? 6 : 2)}</td>
        <td class="num">${PF.Utils.money(total, currency)}</td>
        <td class="num">${fees > 0 ? PF.Utils.money(fees, currency) : '<span style="color:var(--muted)">—</span>'}</td>
        <td class="tx-meta">${metaHtml.join(' ') || '<span style="color:var(--muted)">—</span>'}</td>
        <td class="num"><button class="btn sm ghost" onclick="PF.App.openEdit(${i})" title="\u00C9diter">\u270F\uFE0F</button> <button class="btn danger" onclick="PF.App.removeTransaction(${i})" title="Supprimer">\u2715</button></td>
      </tr>`;
    }).join('');
    PF.UI.renderTxPagination(totalPages, filtered.length);
  },

  renderTxPagination(totalPages, totalItems) {
    const el = PF.Utils.$('txPagination');
    if (!el) return;
    const page = PF.State._txPage;
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    const prevDisabled = page <= 1 ? 'disabled' : '';
    const nextDisabled = page >= totalPages ? 'disabled' : '';
    el.innerHTML = `
      <span class="tx-page-info">Page ${page} / ${totalPages} (${totalItems} transactions)</span>
      <button class="btn ghost sm" data-tx-page="${page - 1}" ${prevDisabled}>\u25C0 Pr\u00e9c\u00e9dente</button>
      <button class="btn ghost sm" data-tx-page="${page + 1}" ${nextDisabled}>Suivante \u25B6</button>
    `;
  },

  renderAlerts(alerts, priceMap, fxRate) {
    const list = PF.Utils.$('alertList'), empty = PF.Utils.$('alertEmpty');
    if (!alerts.length) { list.innerHTML = ''; empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    const currency = PF.State.data.currency;
    list.innerHTML = alerts.map((a, i) => {
      const cur = PF.Engine.getCoinCurPrice(a.coinId, priceMap);
      const tgt = a.targetUSD * fxRate;
      const dirTxt = a.dir === 'above' ? '\u2265' : '\u2264';
      const info = priceMap[a.coinId];
      const img = info ? info.image : '';
      let statusColor = '#8b9bc4', statusTxt = 'En attente';
      if (!a.active) { statusColor = '#64748b'; statusTxt = 'D\u00e9sactiv\u00e9e'; }
      else if (cur == null) { statusColor = '#8b9bc4'; statusTxt = 'Prix indispo.'; }
      else {
        const hit = a.dir === 'above' ? cur >= tgt : cur <= tgt;
        if (hit) { statusColor = '#f59e0b'; statusTxt = '\u26A0 D\u00e9clench\u00e9e'; }
      }
      return `<div class="alert-row">
        <span class="a-name">${img && PF.Utils.isSafeUrl(img) ? `<img src="${PF.Utils.escapeHtml(img)}" style="width:20px;height:20px;border-radius:50%;vertical-align:middle;margin-right:6px" onerror="this.style.display='none'">` : ''}${PF.Utils.escapeHtml(a.name || a.symbol)}</span>
        <span class="a-meta">Cible <b>${dirTxt} ${PF.Utils.money(tgt, currency)}</b></span>
        <span class="a-meta">Actuel <b>${cur != null ? PF.Utils.money(cur, currency) : '\u2014'}</b></span>
        <span class="pill ${a.active ? 'amber' : 'neutral'}"><span class="status-dot" style="background:${statusColor}"></span>${statusTxt}</span>
        <button class="btn sm ghost" onclick="PF.App.toggleAlert(${i})">${a.active ? '\u23F8' : '\u25B6'}</button>
        <button class="btn sm danger" onclick="PF.App.removeAlert(${i})">\u2715</button>
      </div>`;
    }).join('');
  },

  buildPeriodOptions(transactions, positions) {
    const years = new Set();
    transactions.forEach(t => { const y = String(t.date).slice(0, 4); if (y) years.add(y); });
    positions.forEach(p => { const y = String(p.date || '').slice(0, 4); if (y) years.add(y); });
    const sel = PF.Utils.$('periodSel');
    const cur = PF.State.periodFilter;
    sel.innerHTML = '<option value="all">Toutes p\u00e9riodes</option>' +
      [...years].sort().reverse().map(y => `<option value="${y}">${y}</option>`).join('');
    sel.value = cur && [...years].includes(cur) ? cur : 'all';
    if (sel.value !== cur) PF.State.periodFilter = sel.value;
  },

  renderHistory(transactions, history, periodFilter) {
    const body = PF.Utils.$('histBody'), summary = PF.Utils.$('histSummary'), empty = PF.Utils.$('histEmpty');
    const { entries, metrics } = PF.Engine.computeHistoryEntries(transactions, history, periodFilter);
    if (!entries.length) {
      body.innerHTML = '';
      summary.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    const cur = PF.State.data.currency;

    summary.innerHTML = metrics ? `
      <div class="hist-metrics">
        <span class="hm"><span class="hm-lbl">Plus haut</span><span class="hm-val">${PF.Utils.money(metrics.ath, cur)}</span><span class="hm-sub">P&amp;L ${metrics.athPnl >= 0 ? '+' : ''}${PF.Utils.money(metrics.athPnl, cur)} (${metrics.athRet >= 0 ? '+' : ''}${PF.Utils.fmt(metrics.athRet)} %)</span></span>
        <span class="hm"><span class="hm-lbl">Drawdown actuel</span><span class="hm-val ${metrics.drawdown > 0 ? 'neg' : 'pos'}">${PF.Utils.fmt(metrics.drawdown)} %</span><span class="hm-sub">${metrics.drawdown > 0 ? 'sous le sommet' : 'au sommet'}</span></span>
        <span class="hm"><span class="hm-lbl">Meilleur jour</span><span class="hm-val pos">${metrics.bestDay ? (metrics.bestDay.pct >= 0 ? '+' : '') + PF.Utils.fmt(metrics.bestDay.pct) + ' %' : '\u2014'}</span><span class="hm-sub">${metrics.bestDay ? metrics.bestDay.date : ''}</span></span>
        <span class="hm"><span class="hm-lbl">Pire jour</span><span class="hm-val neg">${metrics.worstDay ? (metrics.worstDay.pct >= 0 ? '+' : '') + PF.Utils.fmt(metrics.worstDay.pct) + ' %' : '\u2014'}</span><span class="hm-sub">${metrics.worstDay ? metrics.worstDay.date : ''}</span></span>
      </div>` : '';

    body.innerHTML = entries.map(e => {
      const pnlCls = e.pnl >= 0 ? 'pos' : 'neg';
      const retCls = e.ret >= 0 ? 'pos' : 'neg';
      const dCls = e.dailyChg >= 0 ? 'pos' : 'neg';
      return `<tr>
        <td class="num">${PF.Utils.fmtDate(e.date)}</td>
        <td class="num">${PF.Utils.money(e.invested, cur)}</td>
        <td class="num"><b>${PF.Utils.money(e.value, cur)}</b></td>
        <td class="num ${pnlCls}">${e.pnl >= 0 ? '+' : ''}${PF.Utils.money(e.pnl, cur)}</td>
        <td class="num"><span class="pill ${retCls}">${e.ret >= 0 ? '+' : ''}${PF.Utils.fmt(e.ret)} %</span></td>
        <td class="num ${dCls}">${e.dailyChg >= 0 ? '+' : ''}${PF.Utils.money(e.dailyChg, cur)} <span class="sym">(${e.dailyChgPct >= 0 ? '+' : ''}${PF.Utils.fmt(e.dailyChgPct)} %)</span></td>
      </tr>`;
    }).join('');
  }
};
