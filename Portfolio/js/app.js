window.PF = window.PF || {};

PF.App = {
  _sellSymbol: null,
  _editIndex: null,
  _manualMode: false,
  _debounce: {},
  _saveHandle: null,

  _debounced(key, fn, ms) {
    clearTimeout(PF.App._debounce[key]);
    PF.App._debounce[key] = setTimeout(fn, ms || 150);
  },

  async init() {
    await PF.Crypto.init();
    PF.Notifications.init();
    const hasEncrypted = PF.Crypto.hasEncryptedData();
    const hasLegacy = !!localStorage.getItem(PF.Utils.LS_KEY);

    if (hasEncrypted) {
      PF.App._showPasswordModal(false, false);
    } else if (hasLegacy) {
      PF.App._showPasswordModal(false, true);
    } else {
      PF.App._showPasswordModal(true, false);
    }
  },

  _showPasswordModal(isSetup, hasLegacy) {
    const modal = PF.Utils.$('passwordModal');
    const pwInput = PF.Utils.$('pwInput');
    const pwNewFields = PF.Utils.$('pwNewFields');
    const pwError = PF.Utils.$('pwError');
    const pwMatchError = PF.Utils.$('pwMatchError');
    const pwSubmit = PF.Utils.$('pwSubmit');
    const pwSetupLink = PF.Utils.$('pwSetupLink');
    const pwDesc = PF.Utils.$('pwDesc');
    const pwForgotLink = PF.Utils.$('pwForgotLink');
    const pwRecoverFields = PF.Utils.$('pwRecoverFields');
    const pwRecoveryDisplay = PF.Utils.$('pwRecoveryDisplay');
    const pwRecoveryInput = PF.Utils.$('pwRecoveryInput');
    const pwRecoverBtn = PF.Utils.$('pwRecoverBtn');
    const pwCopyRecoveryBtn = PF.Utils.$('pwCopyRecoveryBtn');

    if (isSetup && !hasLegacy) {
      pwDesc.textContent = 'Créez un mot de passe pour protéger vos données.';
      pwSubmit.textContent = 'Créer et déverrouiller';
      pwNewFields.style.display = 'block';
      pwSetupLink.style.display = 'none';
    } else if (hasLegacy && !isSetup) {
      pwDesc.textContent = 'Entrez votre mot de passe pour accéder à vos données.';
      pwSubmit.textContent = 'Déverrouiller';
    } else if (isSetup) {
      pwDesc.textContent = 'Entrez votre mot de passe pour accéder à vos données.';
      pwSubmit.textContent = 'Déverrouiller';
      pwSetupLink.style.display = 'none';
    }

    pwForgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      pwRecoverFields.style.display = 'block';
      pwRecoveryDisplay.style.display = 'none';
      pwRecoveryInput.focus();
    });

    pwCopyRecoveryBtn.addEventListener('click', () => {
      const key = PF.Utils.$('pwRecoveryKeyText').textContent;
      navigator.clipboard.writeText(key).then(() => {
        PF.UI.toast('Clé copiée \u2713');
      });
    });

    if (isSetup && !hasLegacy) {
      pwDesc.textContent = 'Créez un mot de passe pour protéger vos données.';
      pwSubmit.textContent = 'Créer et déverrouiller';
      pwNewFields.style.display = 'block';
      pwSetupLink.style.display = 'none';
    } else if (hasLegacy && !isSetup) {
      pwDesc.textContent = 'Entrez votre mot de passe pour accéder à vos données.';
      pwSubmit.textContent = 'Déverrouiller';
    } else if (isSetup) {
      pwDesc.textContent = 'Entrez votre mot de passe pour accéder à vos données.';
      pwSubmit.textContent = 'Déverrouiller';
      pwSetupLink.style.display = 'none';
    }

    function showSetupFields() {
      pwNewFields.style.display = 'block';
      pwSubmit.textContent = 'Créer et déverrouiller';
      pwDesc.textContent = 'Créez un mot de passe pour protéger vos données.';
      pwSetupLink.style.display = 'none';
      pwNewFields.querySelector('input').focus();
    }

    pwSetupLink.addEventListener('click', (e) => { e.preventDefault(); showSetupFields(); });
    pwSetupLink.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showSetupFields(); } });

    const handleSubmit = async () => {
      pwError.style.display = 'none';
      pwMatchError.style.display = 'none';

      const pw = pwInput.value;
      if (!pw) { pwError.style.display = 'block'; pwError.textContent = 'Veuillez entrer un mot de passe.'; return; }

      // Recovery mode: set new password
      if (PF.State._recoveryMode && pwNewFields.style.display === 'block') {
        const pwNew = PF.Utils.$('pwNewInput').value;
        const pwConfirm = PF.Utils.$('pwConfirmInput').value;
        if (pwNew !== pwConfirm) { pwMatchError.style.display = 'block'; pwMatchError.textContent = 'Les mots de passe ne correspondent pas.'; return; }
        if (pwNew.length < 4) { pwMatchError.style.display = 'block'; pwMatchError.textContent = 'Minimum 4 caractères.'; return; }
        pwMatchError.style.display = 'none';
        PF.State._password = pwNew;
        PF.State._recoveryMode = false;
        await PF.State.save();
        const recoveryKey = PF.Crypto.generateRecoveryKey();
        await PF.Crypto.saveRecoveryKey(recoveryKey, pwNew);
        PF.Utils.$('pwRecoveryKeyText').textContent = recoveryKey;
        pwRecoveryDisplay.style.display = 'block';
        pwRecoverFields.style.display = 'none';
        return;
      }

      if (pwNewFields.style.display === 'block') {
        const pwNew = PF.Utils.$('pwNewInput').value;
        const pwConfirm = PF.Utils.$('pwConfirmInput').value;
        if (pwNew !== pwConfirm) { pwMatchError.style.display = 'block'; pwMatchError.textContent = 'Les mots de passe ne correspondent pas.'; return; }
        if (pwNew.length < 4) { pwMatchError.style.display = 'block'; pwMatchError.textContent = 'Minimum 4 caractères.'; return; }
        pwMatchError.style.display = 'none';

        if (hasLegacy) {
          const legacyData = JSON.parse(localStorage.getItem(PF.Utils.LS_KEY));
          await PF.Crypto.save(legacyData, pwNew);
          localStorage.removeItem(PF.Utils.LS_KEY);
        }

        PF.State._password = pwNew;
        const success = await PF.State.load(pwNew);
        if (!success) {
          const newData = { transactions: [], manualCoins: {}, alerts: [], history: [], currency: 'usd', theme: 'dark' };
          PF.State.data = newData;
          await PF.State.save();
        }

        // Generate and show recovery key
        const recoveryKey = PF.Crypto.generateRecoveryKey();
        await PF.Crypto.saveRecoveryKey(recoveryKey, pwNew);
        PF.Utils.$('pwRecoveryKeyText').textContent = recoveryKey;
        pwRecoveryDisplay.style.display = 'block';
        pwRecoveryInput.value = '';
        pwRecoverFields.style.display = 'none';
      } else {
        const success = await PF.State.load(pw);
        if (!success) {
          pwError.style.display = 'block';
          pwError.textContent = 'Mot de passe incorrect. Réessayez.';
          return;
        }
        PF.State._password = pw;
      }

      // Don't close modal if recovery key is being displayed
      if (pwRecoveryDisplay.style.display === 'block') return;

      modal.classList.remove('show');
      PF.API.loadCachedPrices();
      PF.API.loadPriceHistory();
      PF.Utils.$('currency').value = PF.State.data.currency || 'usd';
      PF.Utils.$('buyDate').value = PF.Utils.todayISO();
      PF.App.bindEvents();
      PF.App._refreshView();
      PF.App._updateOfflineBanner();
      window.addEventListener('online', () => { PF.App._updateOfflineBanner(); PF.App.refreshPrices(); });
      window.addEventListener('offline', () => { PF.App._updateOfflineBanner(); });
      await PF.App.refreshPrices();
    };

    // Recovery key unlock handler
    const handleRecovery = async () => {
      const recoveryKey = pwRecoveryInput.value.trim();
      if (!recoveryKey) { pwError.style.display = 'block'; pwError.textContent = 'Entrez votre clé de récupération.'; return; }
      const data = await PF.Crypto.unlockWithRecoveryKey(recoveryKey);
      if (!data) { pwError.style.display = 'block'; pwError.textContent = 'Clé de récupération invalide.'; return; }
      PF.State.data = data;
      PF.State._password = null;
      PF.State._recoveryMode = true;

      // Offer to set a new password immediately
      pwError.style.display = 'none';
      pwRecoverFields.style.display = 'none';
      pwDesc.textContent = 'Données récupérées ! Définissez un nouveau mot de passe :';
      pwInput.value = '';
      pwNewFields.style.display = 'block';
      pwSubmit.textContent = 'Définir le nouveau mot de passe';
      pwSetupLink.style.display = 'none';
      pwForgotLink.style.display = 'none';
      PF.Utils.$('pwNewInput').value = '';
      PF.Utils.$('pwConfirmInput').value = '';
      PF.Utils.$('pwNewInput').focus();
    };

    // Close recovery display and allow proceeding
    if (pwRecoveryDisplay) {
      pwRecoveryDisplay.addEventListener('click', (e) => {
        if (e.target === pwCopyRecoveryBtn) return;
      });
    }

    pwSubmit.addEventListener('click', handleSubmit);
    pwRecoverBtn.addEventListener('click', handleRecovery);
    pwRecoveryInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleRecovery(); });
    pwInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSubmit(); });
    pwNewFields.querySelectorAll('input').forEach(inp => inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSubmit(); }));

    // "Continuer" button after recovery key is shown
    const pwContinueBtn = PF.Utils.$('pwContinueBtn');
    pwContinueBtn.addEventListener('click', async () => {
      modal.classList.remove('show');
      PF.API.loadCachedPrices();
      PF.API.loadPriceHistory();
      PF.Utils.$('currency').value = PF.State.data.currency || 'usd';
      PF.Utils.$('buyDate').value = PF.Utils.todayISO();
      PF.App.bindEvents();
      PF.App._refreshView();
      PF.App._updateOfflineBanner();
      window.addEventListener('online', () => { PF.App._updateOfflineBanner(); PF.App.refreshPrices(); });
      window.addEventListener('offline', () => { PF.App._updateOfflineBanner(); });
      await PF.App.refreshPrices();
    });

    pwInput.focus();
  },

  _refreshView() {
    const state = PF.State.data;
    const positions = PF.Engine.computePositions(
      state.transactions, state.manualCoins,
      PF.API.getPriceMap(), PF.API.getFxRate()
    );
    PF.UI.buildPeriodOptions(state.transactions, positions);
  },

  _updateOfflineBanner() {
    let banner = document.getElementById('offlineBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'offlineBanner';
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:200;background:var(--amber);color:#000;text-align:center;padding:6px 12px;font-size:13px;font-weight:600;display:none;';
      document.body.prepend(banner);
    }
    const offline = PF.API.isOffline();
    const cacheAge = PF.API.getCacheAge();
    if (offline) {
      const ageText = cacheAge ? PF.App._formatCacheAge(cacheAge) : '';
      banner.textContent = `\u26A0 Hors ligne — Prix en cache${ageText ? ' (' + ageText + ')' : ''}`;
      banner.style.display = 'block';
    } else if (cacheAge && cacheAge > 3600000) {
      banner.textContent = `\u21BB Prix datant de ${PF.App._formatCacheAge(cacheAge)} — Cliquez Actualiser`;
      banner.style.display = 'block';
      banner.style.background = 'var(--purple)';
    } else {
      banner.style.display = 'none';
    }
  },

  _formatCacheAge(ms) {
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return "< 1 min";
    if (mins < 60) return mins + " min";
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + "h" + (mins % 60 ? " " + (mins % 60) + "min" : "");
    return Math.floor(hours / 24) + "j";
  },

  async refreshPrices() {
    const btn = PF.Utils.$('refreshBtn');
    btn.innerHTML = '<span class="spin"></span>...';
    btn.disabled = true;
    PF.UI.showSkeletons(true);
    try {
      await PF.API.fetchCoins(true);
      PF.Engine._invalidateCache();
      PF.Components.renderCoinCombos();
      PF.App._refreshView();
      PF.App._renderAll();
      PF.App._saveSnapshot();
      PF.App._checkAlerts();
      // Chargement historique en arriere-plan avec feedback
      if (PF.API.fetchPriceHistory) {
        var subEl = PF.Utils.$('lastUpdate');
        var origText = subEl.textContent;
        subEl.textContent = 'Chargement historique...';
        console.log('[Portfolio] Starting history fetch...');
        PF.API.fetchPriceHistory(function(prog) {
          subEl.textContent = 'Historique ' + prog.done + '/' + prog.total + ' (' + prog.loaded + ' ok, ' + prog.failed + ' echec)...';
          console.log('[Portfolio] History progress:', prog.done + '/' + prog.total, prog.loaded + ' loaded');
        }).then(function(result) {
          PF.Engine._invalidateCache();
          PF.Charts.renderTime(PF.State.data.transactions, PF.State.data.history, PF.State.periodFilter);
          PF.UI.renderHistory(PF.State.data.transactions, PF.State.data.history, PF.State.periodFilter);
          console.log('[Portfolio] History done:', JSON.stringify(result));
          if (result && result.loaded > 0) {
            PF.UI.toast('Historique : ' + result.loaded + '/' + result.total + ' tokens charges \u2713');
          } else if (result && result.loaded === 0 && result.total > 0) {
            PF.UI.toast('Echec historique : 0/' + result.total + ' charges (API limite ?)', 'err');
          }
        }).catch(function(err) {
          console.error('[Portfolio] History error:', err);
          PF.UI.toast('Erreur chargement historique', 'err');
        });
      }
      const fxRate = PF.API.getFxRate();
      PF.Utils.$('lastUpdate').textContent =
        `Mis \u00e0 jour le ${new Date().toLocaleString('fr-FR')} \u00b7 ${PF.API.getCoins().length} cryptos \u00b7 1 USD = ${fxRate.toFixed(4)} ${PF.State.data.currency === 'usd' ? 'USD' : 'EUR'}`;
      PF.UI.toast('Prix actualis\u00e9s \u2713');
    } catch (err) {
      console.error(err);
      const hasCache = PF.API.getCoins().length > 0;
      if (hasCache) {
        const age = PF.API.getCacheAge();
        const ageText = age ? ' (cache: ' + PF.App._formatCacheAge(age) + ')' : '';
        PF.UI.toast('API indisponible — prix en cache utilis\u00e9s' + ageText, 'warn');
        PF.Utils.$('lastUpdate').textContent = `Prix en cache${ageText} \u00b7 ${PF.API.getCoins().length} cryptos`;
      } else {
        PF.UI.toast('\u00C9chec du chargement des prix (r\u00e9seau ou limite API). R\u00e9essayez.', 'err');
        PF.Utils.$('lastUpdate').textContent = 'Prix indisponibles \u2014 v\u00e9rifiez votre connexion.';
      }
    } finally {
      PF.UI.showSkeletons(false);
      PF.App._updateOfflineBanner();
      btn.innerHTML = '\uD83D\uDD04 Actualiser';
      btn.disabled = false;
    }
  },

  _renderAll() {
    const state = PF.State.data;
    const priceMap = PF.API.getPriceMap();
    const fxRate = PF.API.getFxRate();
    const positions = PF.Engine.computePositions(state.transactions, state.manualCoins, priceMap, fxRate);
    const txAgg = PF.Engine.computeTxAggregates(state.transactions);

    PF.UI.renderPositions(positions, priceMap, fxRate, txAgg);
    PF.UI.renderSummary(positions, priceMap, fxRate, txAgg);
    PF.Charts.renderPie(positions, priceMap, fxRate, PF.State.chartMode);
    PF.UI.renderTransactions(state.transactions, PF.State.periodFilter);
    PF.Charts.renderTime(state.transactions, state.history, PF.State.periodFilter);
    PF.UI.renderHistory(state.transactions, state.history, PF.State.periodFilter);
    PF.UI.renderAlerts(state.alerts, priceMap, fxRate);
  },

  _getPositionsAndAgg() {
    const state = PF.State.data;
    const priceMap = PF.API.getPriceMap();
    const fxRate = PF.API.getFxRate();
    const positions = PF.Engine.computePositions(state.transactions, state.manualCoins, priceMap, fxRate);
    const txAgg = PF.Engine.computeTxAggregates(state.transactions);
    return { positions, priceMap, fxRate, txAgg, currency: state.currency };
  },

  async _saveSnapshot(force) {
    const state = PF.State.data;
    const { positions, priceMap, fxRate, txAgg } = PF.App._getPositionsAndAgg();
    const summary = PF.Engine.computeSummary(positions, priceMap, fxRate, txAgg);
    const today = PF.Utils.todayISO();
    if (!force && state.history.length && state.history[state.history.length - 1].date === today) return;
    if (force && state.history.length && state.history[state.history.length - 1].date === today) {
      state.history[state.history.length - 1] = { date: today, invested: summary.invested, value: summary.value };
    } else {
      state.history.push({ date: today, invested: summary.invested, value: summary.value });
    }
    if (state.history.length > 365) state.history = state.history.slice(-365);
    await PF.State.save();
  },

  async _checkAlerts() {
    const state = PF.State.data;
    const priceMap = PF.API.getPriceMap();
    const fxRate = PF.API.getFxRate();
    const fired = [];
    for (let i = 0; i < state.alerts.length; i++) {
      const a = state.alerts[i];
      if (!a.active || a.triggered) continue;
      const cur = PF.Engine.getCoinCurPrice(a.coinId, priceMap);
      if (cur == null) continue;
      const tgt = a.targetUSD * fxRate;
      if ((a.dir === 'above' && cur >= tgt) || (a.dir === 'below' && cur <= tgt)) {
        a.triggered = true;
        fired.push(`${a.symbol} ${a.dir === 'above' ? '\u2265' : '\u2264'} ${PF.Utils.money(tgt, state.currency)} (actuel ${PF.Utils.money(cur, state.currency)})`);
      }
    }
    if (fired.length) {
      await PF.State.save();
      for (let i = 0; i < fired.length; i++) PF.UI.toast('\uD83D\uDD14 Alerte atteinte : ' + fired[i], 'warn');
      // Send push notifications
      for (let i = 0; i < state.alerts.length; i++) {
        const a = state.alerts[i];
        if (a.active && a.triggered) {
          const cur = PF.Engine.getCoinCurPrice(a.coinId, priceMap);
          if (cur != null) {
            const tgt = a.targetUSD * fxRate;
            PF.Notifications.sendAlert(a.symbol, a.dir, tgt, cur, state.currency);
          }
        }
      }
    }
    PF.UI.renderAlerts(state.alerts, priceMap, fxRate);
  },

  /* ---- Positions / Transactions ---- */

  async addPosition(e) {
    e.preventDefault();
    const qtyVal = PF.Utils.$('qty').value;
    const buyPriceVal = PF.Utils.$('buyPrice').value;
    const date = PF.Utils.$('buyDate').value;
    const txType = PF.Utils.$('txType').value;
    const feesVal = PF.Utils.$('txFees').value;
    const notesRaw = PF.Utils.$('txNotes').value;
    const tagsRaw = PF.Utils.$('txTags').value;

    const needsPrice = txType === 'buy' || txType === 'sell' || txType === 'swap';

    if (!PF.Utils.isValidDate(date)) { PF.UI.toast('Date invalide (format requis : AAAA-MM-JJ).', 'err'); return; }
    if (!PF.Utils.isValidAmount(qtyVal)) { PF.UI.toast('Quantité invalide (doit être un nombre positif).', 'err'); return; }
    if (needsPrice && !PF.Utils.isValidPrice(buyPriceVal)) { PF.UI.toast('Cours unitaire invalide (doit être un nombre ≥ 0).', 'err'); return; }
    if (!PF.Utils.isValidFees(feesVal)) { PF.UI.toast('Frais invalides.', 'err'); return; }

    const qty = parseFloat(qtyVal);
    const buyPrice = parseFloat(buyPriceVal);
    const fees = parseFloat(feesVal) || 0;
    const notes = PF.Utils.sanitizeString(notesRaw, 300);
    const tags = PF.Utils.sanitizeTags(tagsRaw);

    PF.State.pushUndo('Ajout transaction');

    const state = PF.State.data;
    const fxRate = PF.API.getFxRate();
    let symbol, name;

    if (PF.App._manualMode) {
      const mName = PF.Utils.$('mName').value.trim();
      const mSymbol = PF.Utils.$('mSymbol').value.trim().toUpperCase();
      const curP = PF.Utils.$('mCurPrice').value;
      if (!mName || mName.length > 50) { PF.UI.toast('Nom invalide (1-50 caractères).', 'err'); return; }
      if (!PF.Utils.isValidSymbol(mSymbol)) { PF.UI.toast('Symbole invalide (1-10 caractères, lettres/chiffres).', 'err'); return; }
      if (curP && !PF.Utils.isValidPrice(curP)) { PF.UI.toast('Prix actuel invalide.', 'err'); return; }
      symbol = mSymbol;
      name = PF.Utils.sanitizeString(mName, 50);
      state.manualCoins[symbol] = { name, priceUSD: (parseFloat(curP) || 0) / fxRate };
    } else {
      const combo = PF.Components._combos.add;
      if (!combo) { PF.UI.toast('Recherchez et s\u00e9lectionnez une crypto.', 'err'); return; }
      const id = combo.showSelected();
      if (!id) { PF.UI.toast('Recherchez et s\u00e9lectionnez une crypto.', 'err'); return; }
      const c = PF.API.getCoins().find(c => c.id === id);
      if (!c) { PF.UI.toast('Crypto introuvable.', 'err'); return; }
      symbol = c.symbol;
      name = c.name;
      combo.clearSelection();
    }

    const tx = { date, symbol, type: txType, price: buyPrice, amount: qty, fees, notes, tags };

    // Swap: create two transactions (source sold + destination bought)
    if (txType === 'swap') {
      const swapCombo = PF.Components._combos.swapTo;
      let toSym = '';
      if (swapCombo) {
        const coinId = swapCombo.showSelected();
        if (coinId) {
          const c = PF.API.getCoins().find(c => c.id === coinId);
          if (c) toSym = c.symbol;
        }
      }
      const toAmtVal = PF.Utils.$('swapToAmount').value;
      const toPriceVal = PF.Utils.$('swapToPrice').value;
      if (!toSym || !PF.Utils.isValidAmount(toAmtVal)) {
        PF.UI.toast('Veuillez sélectionner la crypto de destination et indiquer une quantité valide pour le swap.', 'err');
        return;
      }
      const toAmt = parseFloat(toAmtVal);
      const toPrice = parseFloat(toPriceVal) || 0;
      var swapNote = 'Swap ' + symbol + ' \u2192 ' + toSym;
      tx.notes = notes || swapNote;
      state.transactions.push({
        date, symbol: toSym, type: 'swap',
        price: toPrice || buyPrice, amount: toAmt,
        fees: 0, notes: notes || swapNote, tags: tags.length ? tags : [], swapIn: true
      });
    }

    state.transactions.push(tx);

    // Auto-deduct from USDT for buy/swap
    const fromUSDT = PF.Utils.$('buyFromUSDT').checked && symbol !== 'USDT' && (txType === 'buy' || txType === 'swap');
    if (fromUSDT) {
      state.transactions.push({
        date, symbol: 'USDT', type: 'sell',
        price: fxRate, amount: qty * buyPrice / fxRate,
        fees: 0, notes: 'Auto-d\u00e9duction USDT', tags: [], _autoUSDT: true, _fundedSymbol: symbol
      });
    }

    PF.Engine._invalidateCache();
    await PF.State.save();
    PF.App._refreshView();
    PF.Utils.$('qty').value = '';
    PF.Utils.$('buyPrice').value = '';
    PF.Utils.$('txFees').value = '';
    PF.Utils.$('txNotes').value = '';
    PF.Utils.$('txTags').value = '';
    // Clear swap fields
    if (PF.Components._combos.swapTo) PF.Components._combos.swapTo.clearSelection();
    PF.Utils.$('swapToAmount').value = '';
    PF.Utils.$('swapToPrice').value = '';
    PF.App._renderAll();
    const typeLabel = PF.State.TX_TYPE_LABELS[txType] || txType;
    let msg = `${typeLabel} ajout\u00e9e \u2713`;
    if (fromUSDT) msg += ` \u00b7 ${PF.Utils.money(qty * buyPrice, state.currency)} d\u00e9duits des USDT`;
    if (fees > 0) msg += ` \u00b7 Frais: ${PF.Utils.money(fees, state.currency)}`;
    PF.UI.toast(msg);
  },

  async removeAllTransactions(symbol) {
    if (!confirm(`Supprimer toutes les transactions pour ${symbol} ?`)) return;
    PF.State.pushUndo('Suppression position');
    PF.State.data.transactions = PF.State.data.transactions.filter(t => t.symbol !== symbol && !(t._autoUSDT && t._fundedSymbol === symbol));
    if (PF.State.data.manualCoins[symbol]) delete PF.State.data.manualCoins[symbol];
    PF.Engine._invalidateCache();
    await PF.State.save();
    PF.App._refreshView();
    PF.App._renderAll();
    PF.UI.toast(`Position ${symbol} supprim\u00e9e`);
  },


  /* ---- Edit Transaction ---- */
  openEdit(i) {
    var t = PF.State.data.transactions[i];
    if (!t) { PF.UI.toast('Transaction introuvable.', 'err'); return; }
    PF.App._editIndex = i;
    PF.Utils.$('editDate').value = t.date;
    PF.Utils.$('editSymbol').value = t.symbol;
    PF.Utils.$('editType').value = t.type;
    PF.Utils.$('editQty').value = t.amount;
    PF.Utils.$('editPrice').value = t.price;
    PF.Utils.$('editFees').value = t.fees || 0;
    PF.Utils.$('editNotes').value = t.notes || '';
    PF.Utils.$('editTags').value = (t.tags || []).join(', ');
    PF.Utils.$('editModal').classList.add('show');
    PF.App._trapFocus(PF.Utils.$('editModal'));
  },

  _closeEdit() {
    PF.Utils.$('editModal').classList.remove('show');
    PF.App._untrapFocus(PF.Utils.$('editModal'));
    PF.App._editIndex = null;
  },

  async _confirmEdit() {
    var i = PF.App._editIndex;
    if (i == null) return;
    var t = PF.State.data.transactions[i];
    if (!t) return;
    PF.State.pushUndo('Modification transaction');
    var newDate = PF.Utils.$('editDate').value;
    var newSymbol = PF.Utils.$('editSymbol').value.trim().toUpperCase();
    var newType = PF.Utils.$('editType').value;
    var newQtyVal = PF.Utils.$('editQty').value;
    var newPriceVal = PF.Utils.$('editPrice').value;
    var newFeesVal = PF.Utils.$('editFees').value;

    if (!PF.Utils.isValidDate(newDate)) { PF.UI.toast('Date invalide.', 'err'); return; }
    if (!PF.Utils.isValidSymbol(newSymbol)) { PF.UI.toast('Symbole invalide.', 'err'); return; }
    if (!PF.Utils.isValidAmount(newQtyVal)) { PF.UI.toast('Quantité invalide.', 'err'); return; }
    if (!PF.Utils.isValidPrice(newPriceVal)) { PF.UI.toast('Prix invalide.', 'err'); return; }
    if (!PF.Utils.isValidFees(newFeesVal)) { PF.UI.toast('Frais invalides.', 'err'); return; }

    t.date = newDate;
    t.symbol = newSymbol;
    t.type = newType;
    t.price = parseFloat(newPriceVal);
    t.amount = parseFloat(newQtyVal);
    t.fees = parseFloat(newFeesVal) || 0;
    t.notes = PF.Utils.sanitizeString(PF.Utils.$('editNotes').value, 300);
    t.tags = PF.Utils.sanitizeTags(PF.Utils.$('editTags').value);
    PF.App._closeEdit();
    PF.Engine._invalidateCache();
    await PF.State.save();
    PF.App._refreshView();
    PF.App._renderAll();
    PF.UI.toast('Transaction modifi\u00e9e \u2713');
  },

  /* ---- Undo ---- */
  async _undo() {
    var e = PF.State.popUndo();
    if (!e) { PF.UI.toast('Rien \u00e0 annuler', 'err'); return; }
    PF.State.data = e.data;
    PF.Engine._invalidateCache();
    await PF.State.save();
    PF.App._refreshView();
    PF.App._renderAll();
    PF.UI.toast('Action annul\u00e9e \u2713');
  },

  /* ---- Theme ---- */
  async _toggleTheme() {
    var isLight = document.body.classList.toggle('light');
    PF.State.data.theme = isLight ? 'light' : 'dark';
    await PF.State.save();
    PF.Utils.$('themeBtn').innerHTML = isLight ? '\u2600\uFE0F' : '\uD83C\uDF13';
  },

  /* ---- JSON ---- */
  _exportJSON() {
    var d = { version: 2, exportedAt: new Date().toISOString(), currency: PF.State.data.currency, transactions: PF.State.data.transactions, manualCoins: PF.State.data.manualCoins, alerts: PF.State.data.alerts, history: PF.State.data.history };
    var j = JSON.stringify(d, null, 2);
    var self = this;
    async function doSave() {
      if (self._jsonHandle) {
        var writable = await self._jsonHandle.createWritable();
        await writable.write(j);
        await writable.close();
        PF.UI.toast('Sauvegarde JSON export\u00e9e \u2713');
        return;
      }
      try {
        var handle = await window.showSaveFilePicker({
          suggestedName: 'portfolio_backup_' + PF.Utils.todayISO() + '.json',
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
        });
        self._jsonHandle = handle;
        var writable = await handle.createWritable();
        await writable.write(j);
        await writable.close();
        PF.UI.toast('Sauvegarde JSON export\u00e9e \u2713');
      } catch (e) {
        if (e.name === 'AbortError') return;
        var b = new Blob([j], { type: 'application/json;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = 'portfolio_backup_' + PF.Utils.todayISO() + '.json';
        a.click();
        URL.revokeObjectURL(a.href);
        PF.UI.toast('Sauvegarde JSON export\u00e9e (fallback) \u2713');
      }
    }
    doSave();
  },

  _exportPDF() {
    const state = PF.State.data;
    const priceMap = PF.API.getPriceMap();
    const fxRate = PF.API.getFxRate();
    const positions = PF.Engine.computePositions(state.transactions, state.manualCoins, priceMap, fxRate);
    const txAgg = PF.Engine.computeTxAggregates(state.transactions);
    const summary = PF.Engine.computeSummary(positions, priceMap, fxRate, txAgg);
    const cur = state.currency;
    const curLabel = cur === 'eur' ? 'EUR' : 'USD';
    const now = new Date().toLocaleString('fr-FR');

    let rows = '';
    positions.forEach(p => {
      const pl = PF.Engine.computePositionPL(p, priceMap, fxRate, txAgg);
      const alloc = summary.value > 0 ? (pl.currentValue / summary.value * 100).toFixed(1) : 0;
      rows += `<tr>
        <td><b>${PF.Utils.escapeHtml(p.name)}</b> <span style="color:#888">(${PF.Utils.escapeHtml(p.symbol)})</span></td>
        <td style="text-align:right">${PF.Utils.fmt(p.qty, p.qty < 1 ? 6 : 4)}</td>
        <td style="text-align:right">${PF.Utils.money(pl.curPrice, cur)}</td>
        <td style="text-align:right">${PF.Utils.money(pl.currentValue, cur)}</td>
        <td style="text-align:right">${PF.Utils.money(pl.invested, cur)}</td>
        <td style="text-align:right;color:${pl.pl >= 0 ? '#22c55e' : '#f87171'}">${pl.pl >= 0 ? '+' : ''}${PF.Utils.money(pl.pl, cur)}</td>
        <td style="text-align:right;color:${pl.ret >= 0 ? '#22c55e' : '#f87171'}">${pl.ret >= 0 ? '+' : ''}${PF.Utils.fmt(pl.ret)} %</td>
        <td style="text-align:right;color:#888">${alloc} %</td>
      </tr>`;
    });

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Portfolio Crypto — ${now}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',system-ui,sans-serif; color:#1a1a2e; padding:40px; font-size:13px; }
  h1 { font-size:22px; margin-bottom:4px; }
  .meta { color:#666; margin-bottom:24px; font-size:12px; }
  .summary { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px; }
  .sum-card { background:#f5f7fa; border:1px solid #e2e8f0; border-radius:8px; padding:14px; }
  .sum-label { font-size:11px; color:#666; text-transform:uppercase; letter-spacing:.5px; }
  .sum-val { font-size:18px; font-weight:700; margin-top:4px; }
  .pos { color:#22c55e; } .neg { color:#f87171; }
  table { width:100%; border-collapse:collapse; margin-bottom:24px; }
  th { text-align:left; font-size:11px; color:#666; text-transform:uppercase; letter-spacing:.5px; padding:8px 10px; border-bottom:2px solid #e2e8f0; }
  td { padding:10px; border-bottom:1px solid #f0f0f0; }
  tr:nth-child(even) { background:#f9fafb; }
  .footer { margin-top:30px; padding-top:16px; border-top:1px solid #e2e8f0; font-size:11px; color:#999; text-align:center; }
  @media print { body { padding:20px; } }
</style>
</head>
<body>
  <h1>&#8383; Portfolio Crypto</h1>
  <div class="meta">Généré le ${now} &middot; ${positions.length} positions &middot; Devise: ${curLabel}</div>

  <div class="summary">
    <div class="sum-card"><div class="sum-label">Total investi</div><div class="sum-val">${PF.Utils.money(summary.invested, cur)}</div></div>
    <div class="sum-card"><div class="sum-label">Valeur actuelle</div><div class="sum-val">${PF.Utils.money(summary.value, cur)}</div></div>
    <div class="sum-card"><div class="sum-label">P&L total</div><div class="sum-val ${summary.pl >= 0 ? 'pos' : 'neg'}">${summary.pl >= 0 ? '+' : ''}${PF.Utils.money(summary.pl, cur)}</div></div>
    <div class="sum-card"><div class="sum-label">Rendement</div><div class="sum-val ${summary.ret >= 0 ? 'pos' : 'neg'}">${summary.ret >= 0 ? '+' : ''}${PF.Utils.fmt(summary.ret)} %</div></div>
  </div>

  <table>
    <thead><tr>
      <th>Crypto</th><th style="text-align:right">Quantité</th><th style="text-align:right">Cours</th>
      <th style="text-align:right">Valeur</th><th style="text-align:right">Investi</th>
      <th style="text-align:right">P&L</th><th style="text-align:right">Rendement</th><th style="text-align:right">Poids</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">Données CoinGecko &middot; Exporté depuis Portfolio Crypto &middot; ${now}</div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => { win.print(); }, 500);
    } else {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'portfolio_' + PF.Utils.todayISO() + '.html';
      a.click();
      URL.revokeObjectURL(a.href);
    }
    PF.UI.toast('PDF prêt — utilisez Imprimer (Ctrl+P) pour sauvegarder en PDF');
  },


  /* ---- Sell ---- */

  openSell(symbol) {
    PF.App._sellSymbol = symbol;
    const { positions, priceMap, fxRate } = PF.App._getPositionsAndAgg();
    const pos = positions.find(p => p.symbol === symbol);
    if (!pos) { PF.UI.toast('Position introuvable.', 'err'); return; }
    const sellPrice = PF.Engine.getCurPrice(pos, priceMap, fxRate);
    PF.Utils.$('sellCoin').value = `${PF.Utils.escapeHtml(pos.name)} (${PF.Utils.escapeHtml(pos.symbol)})`;
    PF.Utils.$('sellHeld').value = PF.Utils.fmt(pos.qty, pos.qty < 1 ? 8 : 6) + ' ' + pos.symbol;
    PF.Utils.$('sellQty').value = '';
    PF.Utils.$('sellQty').max = pos.qty;
    PF.Utils.$('sellPrice').value = sellPrice;
    PF.Utils.$('sellDate').value = PF.Utils.todayISO();
    PF.Utils.$('sellToUSDT').checked = symbol !== 'USDT';
    PF.Utils.$('sellToUSDT').disabled = symbol === 'USDT';
    PF.Utils.$('sellPreview').innerHTML = 'Entrez une quantit\u00e9 pour voir l\'aper\u00e7u.';
    PF.Utils.$('sellModal').classList.add('show');
    PF.App._trapFocus(PF.Utils.$('sellModal'));
  },

  _closeSell() {
    PF.Utils.$('sellModal').classList.remove('show');
    PF.App._untrapFocus(PF.Utils.$('sellModal'));
    PF.App._sellSymbol = null;
  },

  _updateSellPreview() {
    const symbol = PF.App._sellSymbol;
    if (!symbol) return;
    const { positions, priceMap, fxRate, currency } = PF.App._getPositionsAndAgg();
    const pos = positions.find(p => p.symbol === symbol);
    if (!pos) return;
    const qty = parseFloat(PF.Utils.$('sellQty').value) || 0;
    const price = parseFloat(PF.Utils.$('sellPrice').value) || 0;
    const toUSDT = PF.Utils.$('sellToUSDT').checked;
    if (qty <= 0 || price <= 0) { PF.Utils.$('sellPreview').innerHTML = 'Entrez une quantit\u00e9 pour voir l\'aper\u00e7u.'; return; }
    if (qty > pos.qty) { PF.Utils.$('sellPreview').innerHTML = '<span style="color:var(--red)">\u26A0 Quantit\u00e9 sup\u00e9rieure \u00e0 la position d\u00e9tenue.</span>'; return; }
    const proceeds = qty * price;
    const buyCost = qty * PF.Engine.getBuyPrice(pos, fxRate);
    const pnl = proceeds - buyCost;
    const cls = pnl >= 0 ? 'var(--green)' : 'var(--red)';
    let html = `<b>Produit de la vente :</b> ${PF.Utils.money(proceeds, currency)}<br>`;
    html += `<b>Co\u00fbt d'achat des ${PF.Utils.fmt(qty)} ${symbol} :</b> ${PF.Utils.money(buyCost, currency)}<br>`;
    html += `<b>P&amp;L sur cette vente :</b> <span style="color:${cls}">${pnl >= 0 ? '+' : ''}${PF.Utils.money(pnl, currency)}</span><br>`;
    html += toUSDT
      ? `<br>\uD83D\uDCB0 Le produit (${PF.Utils.money(proceeds, currency)}) sera ajout\u00e9 \u00e0 votre <b>balance USDT</b>.`
      : `<br>\uD83D\uDCE4 Le produit sort du portefeuille (retrait).`;
    PF.Utils.$('sellPreview').innerHTML = html;
  },

  async _confirmSell() {
    const symbol = PF.App._sellSymbol;
    if (!symbol) return;
    const state = PF.State.data;
    const qtyVal = PF.Utils.$('sellQty').value;
    const priceVal = PF.Utils.$('sellPrice').value;
    if (!PF.Utils.isValidAmount(qtyVal) || !PF.Utils.isValidPrice(priceVal)) {
      PF.UI.toast('Quantité et prix doivent être des nombres positifs valides.', 'err');
      return;
    }
    const qty = parseFloat(qtyVal);
    const price = parseFloat(priceVal);

    const { positions, priceMap, fxRate } = PF.App._getPositionsAndAgg();
    const pos = positions.find(p => p.symbol === symbol);
    if (!pos || qty > pos.qty) { PF.UI.toast('Quantité supérieure à la position détenue.', 'err'); return; }

    const proceeds = qty * price;
    const toUSDT = PF.Utils.$('sellToUSDT').checked;
    const sellDateRaw = PF.Utils.$('sellDate').value;
    const sellDate = (PF.Utils.isValidDate(sellDateRaw) ? sellDateRaw : PF.Utils.todayISO());
    state.transactions.push({ date: sellDate, symbol, type: 'sell', price, amount: qty, _toUSDT: !!toUSDT });
    if (toUSDT) {
      state.transactions.push({
        date: sellDate, symbol: 'USDT', type: 'buy',
        price: fxRate, amount: qty * price / fxRate,
        _autoUSDT: true, _fundedSymbol: symbol
      });
    }

    PF.App._closeSell();
    PF.Engine._invalidateCache();
    await PF.State.save();
    PF.App._refreshView();
    PF.App._renderAll();
    PF.UI.toast(`Vente confirm\u00e9e : ${PF.Utils.fmt(qty)} ${symbol} \u00e0 ${PF.Utils.money(price, state.currency)} \u2192 ${PF.Utils.money(proceeds, state.currency)} ${toUSDT ? '(\u2192 USDT)' : '(sorti)'}`);
  },

  /* ---- Transactions ---- */

  async removeTransaction(i) {
    if (!confirm('Supprimer cette transaction de l\'historique ?')) return;
    PF.State.pushUndo('Suppression transaction');
    PF.State.data.transactions.splice(i, 1);
    PF.Engine._invalidateCache();
    await PF.State.save();
    PF.App._refreshView();
    PF.State._txPage = 1;
    PF.App._renderAll();
    PF.UI.toast('Transaction supprim\u00e9e');
  },

  /* ---- Alerts ---- */

  async addAlert(e) {
    e.preventDefault();
    const combo = PF.Components._combos.alert;
    if (!combo) { PF.UI.toast('Recherchez une crypto.', 'err'); return; }
    const coinId = combo.showSelected();
    const targetVal = PF.Utils.$('alertTarget').value;
    const dir = PF.Utils.$('alertDir').value;
    if (!coinId || !PF.Utils.isValidPrice(targetVal)) {
      PF.UI.toast('Recherchez une crypto et saisissez un prix cible valide.', 'err');
      return;
    }
    const target = parseFloat(targetVal);
    const c = PF.API.getCoins().find(c => c.id === coinId);
    PF.State.data.alerts.push({
      coinId, symbol: c ? c.symbol : '', name: c ? c.name : '',
      targetUSD: target / PF.API.getFxRate(), dir, active: true, triggered: false
    });
    await PF.State.save();
    PF.Utils.$('alertTarget').value = '';
    combo.clearSelection();
    PF.UI.renderAlerts(PF.State.data.alerts, PF.API.getPriceMap(), PF.API.getFxRate());
    PF.UI.toast('Alerte cr\u00e9\u00e9e \u2713');
    // Request notification permission if not yet granted
    if (PF.Notifications.isSupported() && Notification.permission === 'default') {
      PF.Notifications.requestPermission();
    }
  },

  async removeAlert(i) { PF.State.data.alerts.splice(i, 1); await PF.State.save(); PF.UI.renderAlerts(PF.State.data.alerts, PF.API.getPriceMap(), PF.API.getFxRate()); },

  async toggleAlert(i) {
    const a = PF.State.data.alerts[i];
    a.active = !a.active; a.triggered = false;
    await PF.State.save();
    PF.UI.renderAlerts(PF.State.data.alerts, PF.API.getPriceMap(), PF.API.getFxRate());
  },

  /* ---- CSV ---- */

  async _handleFiles(fileList) {
    if (!fileList || !fileList.length) return;
    let totalAdded = 0;
    let jsonImported = false;
    for (const file of fileList) {
      try {
        const text = await file.text();
        if (file.name.endsWith('.json')) {
          const result = PF.App._importJSONText(text);
          if (result) jsonImported = true;
        } else {
          totalAdded += PF.App._importCSVText(text);
        }
      } catch (err) { console.error(err); PF.UI.toast('Lecture \u00e9chou\u00e9e : ' + file.name, 'err'); }
    }
    if (jsonImported) {
      PF.Engine._invalidateCache();
      await PF.State.save();
      PF.App._refreshView();
      PF.State._txPage = 1;
      PF.App._renderAll();
      PF.UI.toast('Donn\u00e9es JSON import\u00e9es \u2713');
    } else if (totalAdded) {
      var unknown = [...new Set(PF.State.data.transactions.map(function(t){return t.symbol;}))]
        .filter(function(s){ return s !== 'USDT' && !PF.API.resolveCoinId(s); });
      if (unknown.length) console.warn('Tokens non list\u00e9s CoinGecko :', unknown);
      PF.Engine._invalidateCache();
      await PF.State.save();
      PF.App._refreshView();
      PF.State._txPage = 1;
      PF.App._renderAll();
      PF.UI.toast(`${totalAdded} transaction(s) import\u00e9e(s) \u2713`);
    } else {
      PF.UI.toast('Aucune donn\u00e9e reconnue dans le fichier.', 'err');
    }
  },

  _importJSONText(text) {
    try {
      const d = JSON.parse(text);
      if (!d || !Array.isArray(d.transactions)) return false;
      PF.State.pushUndo('Import JSON');
      if (d.transactions.length) {
        d.transactions.forEach(t => {
          if (t.date && t.symbol && t.type && t.amount > 0) {
            PF.State.data.transactions.push({
              date: t.date,
              symbol: t.symbol.toUpperCase(),
              type: t.type,
              price: parseFloat(t.price) || 0,
              amount: parseFloat(t.amount) || 0,
              fees: parseFloat(t.fees) || 0,
              notes: t.notes || '',
              tags: Array.isArray(t.tags) ? t.tags : []
            });
          }
        });
      }
      if (d.manualCoins) Object.assign(PF.State.data.manualCoins, d.manualCoins);
      if (d.alerts && d.alerts.length) d.alerts.forEach(a => PF.State.data.alerts.push(a));
      if (d.history && d.history.length) {
        const existingDates = new Set(PF.State.data.history.map(h => h.date));
        d.history.forEach(h => { if (!existingDates.has(h.date)) PF.State.data.history.push(h); });
        PF.State.data.history.sort((a, b) => a.date < b.date ? -1 : 1);
      }
      if (d.currency) PF.State.data.currency = d.currency;
      return true;
    } catch (e) {
      console.error('[Import JSON] Parse error:', e);
      return false;
    }
  },

  _parseCSVLine(line) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else { if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; }
    }
    out.push(cur);
    return out;
  },

  _importCSVText(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    let start = 0;
    for (let i = 0; i < lines.length; i++) {
      if (/Date/i.test(lines[i]) && /Token/i.test(lines[i])) { start = i + 1; break; }
    }
    let added = 0;
    const VALID_TYPES = ['buy', 'sell', 'transfer_in', 'transfer_out', 'swap', 'staking_reward', 'airdrop'];
    for (let i = start; i < lines.length; i++) {
      const f = PF.App._parseCSVLine(lines[i]);
      if (f.length < 5) continue;
      const date = f[0].trim().split(' ')[0];
      const symbol = f[1].trim().toUpperCase();
      const type = f[2].trim().toLowerCase();
      const priceVal = f[3].trim();
      const amountVal = f[4].trim();

      if (!PF.Utils.isValidDate(date)) continue;
      if (!PF.Utils.isValidSymbol(symbol)) continue;
      if (!VALID_TYPES.includes(type)) continue;
      if (!PF.Utils.isValidPrice(priceVal)) continue;
      if (!PF.Utils.isValidAmount(amountVal)) continue;

      PF.State.data.transactions.push({
        date,
        symbol,
        type,
        price: parseFloat(priceVal),
        amount: parseFloat(amountVal),
        fees: 0,
        notes: '',
        tags: []
      });
      added++;
    }
    return added;
  },

 

  _exportCSV() {
    const txs = PF.State.data.transactions;
    if (!txs.length) { PF.UI.toast('Aucune transaction à exporter.', 'err'); return; }
    const cur = PF.State.data.currency;
    const periodFilter = PF.State.periodFilter;
    const inPeriod = (dateStr) => periodFilter === 'all' || String(dateStr || '').slice(0, 4) === periodFilter;
    const filtered = txs.filter(t => inPeriod(t.date));
    if (!filtered.length) { PF.UI.toast('Aucune transaction pour cette période.', 'err'); return; }
    const rows = [['Date','Token','Type','Price','Amount','Total','Currency']];
    for (let i = 0; i < filtered.length; i++) {
      const t = filtered[i];
      rows.push([t.date, t.symbol, t.type, t.price, t.amount, (t.price * t.amount).toFixed(2), cur.toUpperCase()]);
    }
    const csv = rows.map(r => r.map(v => {
      const s = String(v);
      return /[",]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\n');

    const self = this;
    async function doSave() {
      if (self._saveHandle) {
        // Écrasement direct du fichier déjà choisi
        const writable = await self._saveHandle.createWritable();
        await writable.write(csv);
        await writable.close();
        PF.UI.toast(filtered.length + ' transactions sauvegardées ✓');
        return;
      }
      // Premier clic : demande où sauvegarder
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: 'portfolio_transactions.csv',
          types: [{ description: 'CSV', accept: { 'text/csv': ['.csv'] } }]
        });
        self._saveHandle = handle;
        const writable = await handle.createWritable();
        await writable.write(csv);
        await writable.close();
        PF.UI.toast(filtered.length + ' transactions sauvegardées ✓ — prochain clic = écrasement direct');
      } catch (e) {
        if (e.name === 'AbortError') return; // utilisateur a annulé
        // Fallback : téléchargement classique
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'portfolio_transactions_' + PF.Utils.todayISO() + '.csv';
        a.click();
        URL.revokeObjectURL(a.href);
        PF.UI.toast(filtered.length + ' transactions exportées (fallback) ✓');
      }
    }
    doSave();
  },

  /* ---- Events ---- */

  bindEvents() {
    const $ = PF.Utils.$;
    const self = PF.App;

    // Settings dropdown toggle
    const settingsBtn = $('settingsBtn');
    const settingsMenu = $('settingsMenu');
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      settingsMenu.classList.toggle('show');
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#settingsDropdown')) settingsMenu.classList.remove('show');
    });
    // Close dropdown when an item is clicked
    settingsMenu.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', () => settingsMenu.classList.remove('show'));
    });

    $('addForm').addEventListener('submit', (e) => self.addPosition(e));
    $('txType').addEventListener('change', () => {
      const isSwap = $('txType').value === 'swap';
      $('swapFields').style.display = isSwap ? '' : 'none';
      // Hide USDT deduction for non-buy types and swaps
      const isBuy = $('txType').value === 'buy';
      $('buyFromUSDT').closest('.check-inline').style.display = isBuy ? '' : 'none';
      if (isSwap) $('buyFromUSDT').checked = false;
      else if (isBuy) $('buyFromUSDT').checked = true;
      // Update price label and default value
      const priceLabel = $('buyPrice').closest('.field').querySelector('label');
      const type = $('txType').value;
      if (type === 'airdrop' || type === 'staking_reward') {
        priceLabel.textContent = 'Prix unitaire (optionnel)';
        $('buyPrice').value = '0';
      } else {
        priceLabel.textContent = 'Cours unitaire';
      }
    });
    // Auto-recalc swap received amount when qty or source price changes
    $('qty').addEventListener('input', () => {
      if ($('txType').value === 'swap' && PF.Components._combos.swapTo && PF.Components._combos.swapTo.showSelected()) {
        PF.Components._autoCalcSwapTo();
      }
    });
    $('buyPrice').addEventListener('input', () => {
      if ($('txType').value === 'swap' && PF.Components._combos.swapTo && PF.Components._combos.swapTo.showSelected()) {
        PF.Components._autoCalcSwapTo();
      }
    });
    $('alertForm').addEventListener('submit', (e) => self.addAlert(e));
    $('refreshBtn').addEventListener('click', () => self.refreshPrices());
    $('exportBtn').addEventListener('click', () => self._exportCSV());
    $('undoBtn').addEventListener('click', () => self._undo());
    $('themeBtn').addEventListener('click', () => self._toggleTheme());
    $('notifBtn').addEventListener('click', async () => {
      if (!PF.Notifications.isSupported()) {
        PF.UI.toast('Notifications non supportées par ce navigateur.', 'err');
        return;
      }
      const granted = await PF.Notifications.requestPermission();
      if (granted) {
        PF.UI.toast('Notifications activées \u2713');
        PF.Utils.$('notifBtn').textContent = '\uD83D\uDD14';
      } else if (Notification.permission === 'denied') {
        PF.UI.toast('Notifications bloquées par le navigateur.', 'err');
      } else {
        PF.UI.toast('Permission de notification refusée.', 'err');
      }
    });
    // Update notif button icon based on permission
    if (PF.Notifications.isSupported() && Notification.permission === 'granted') {
      PF.Utils.$('notifBtn').textContent = '\uD83D\uDD14';
    }
    $('jsonBtn').addEventListener('click', () => self._exportJSON());
    $('pdfBtn').addEventListener('click', () => self._exportPDF());

    $('clearBtn').addEventListener('click', async () => {
      if (!confirm('Effacer TOUTES les transactions et alertes ?')) return;
      PF.State.pushUndo('Tout effacer');
      PF.State.data.transactions = [];
      PF.State.data.manualCoins = {};
      PF.State.data.alerts = [];
      PF.State.data.history = [];
      PF.Engine._invalidateCache();
      await PF.State.save();
      PF.App._refreshView();
      PF.App._renderAll();
      PF.UI.toast('Donn\u00e9es effac\u00e9es');
    });

    $('importBtn').addEventListener('click', () => $('importFile').click());
    $('importFile').addEventListener('change', (e) => { self._handleFiles(e.target.files); e.target.value = ''; });

    $('currency').addEventListener('change', async () => {
      PF.State.data.currency = $('currency').value;
      await PF.State.save();
      PF.API.priceHistory = {};
      PF.API._histTimestamps = {};
      PF.API.savePriceHistory();
      await PF.App.refreshPrices();
    });
    
    // Chart mode toggle (Valeur / Investi) — only in repartition view
    document.querySelectorAll('.chart-repartition-controls button[data-mode]').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('.chart-repartition-controls button[data-mode]').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        PF.State.chartMode = b.dataset.mode;
        const { positions, priceMap, fxRate } = PF.App._getPositionsAndAgg();
        PF.Charts.renderPie(positions, priceMap, fxRate, PF.State.chartMode);
      });
    });

    // Chart view toggle: Holdings / R\u00e9partition
    document.querySelectorAll('#chartPanel .view-toggle .btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view === PF.State._chartView) return;
        PF.State._chartView = view;
        document.querySelectorAll('#chartPanel .view-toggle .btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
        document.querySelectorAll('#chartPanel .view-content').forEach(el => el.style.display = el.id === 'viewHoldings' ? (view === 'holdings' ? '' : 'none') : (view === 'repartition' ? '' : 'none'));
        document.querySelector('.chart-holdings-controls').style.display = view === 'holdings' ? '' : 'none';
        document.querySelector('.chart-repartition-controls').style.display = view === 'repartition' ? '' : 'none';
      });
    });

    $('periodSel').addEventListener('change', () => {
      PF.State.periodFilter = $('periodSel').value;
      PF.State._txPage = 1;
      PF.UI.renderTransactions(PF.State.data.transactions, PF.State.periodFilter);
      PF.UI.renderHistory(PF.State.data.transactions, PF.State.data.history, PF.State.periodFilter);
      PF.Charts.renderTime(PF.State.data.transactions, PF.State.data.history, PF.State.periodFilter);
    });

    $('histRecalcBtn').addEventListener('click', () => {
      PF.App._saveSnapshot(true);
      PF.UI.renderHistory(PF.State.data.transactions, PF.State.data.history, PF.State.periodFilter);
      PF.Charts.renderTime(PF.State.data.transactions, PF.State.data.history, PF.State.periodFilter);
      PF.UI.toast('Snapshot du jour mis \u00e0 jour \u2713');
    });

    $('histClearBtn').addEventListener('click', async () => {
      if (!confirm('Effacer tout l\'historique de valeur ?')) return;
      PF.State.data.history = [];
      await PF.State.save();
      PF.UI.renderHistory(PF.State.data.transactions, PF.State.data.history, PF.State.periodFilter);
      PF.Charts.renderTime(PF.State.data.transactions, PF.State.data.history, PF.State.periodFilter);
      PF.UI.toast('Historique effac\u00e9');
    });
	$('histForceBtn').addEventListener('click', async () => {
      if (!confirm('Vider le cache des prix historiques et tout recharger ?')) return;
      PF.API._histTimestamps = {};
      PF.API.priceHistory = {};
      PF.API.savePriceHistory();
      PF.UI.toast('Cache vidé, rechargement...');
      await PF.App.refreshPrices();
    });

    // Debounced search/filter
    $('txSearch').addEventListener('input', () => {
      PF.State._txSearch = $('txSearch').value;
      PF.State._txPage = 1;
      self._debounced('tx', () => PF.UI.renderTransactions(PF.State.data.transactions, PF.State.periodFilter), 120);
      $('txSearchClear').classList.toggle('show', $('txSearch').value.length > 0);
    });
    $('txTypeFilter').addEventListener('change', () => {
      PF.State._txTypeFilter = $('txTypeFilter').value;
      PF.State._txPage = 1;
      PF.UI.renderTransactions(PF.State.data.transactions, PF.State.periodFilter);
    });

    // Pagination clicks for transaction history
    document.getElementById('txPagination').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tx-page]');
      if (!btn || btn.disabled) return;
      PF.State._txPage = parseInt(btn.dataset.txPage, 10);
      PF.UI.renderTransactions(PF.State.data.transactions, PF.State.periodFilter);
    });

    // View toggle: positions / transactions
    document.querySelectorAll('#posPanel .view-toggle .btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view !== 'positions' && view !== 'transactions') return;
        if (view === PF.State._txView) return;
        PF.State._txView = view;
        document.querySelectorAll('#posPanel .view-toggle .btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
        document.querySelectorAll('#posPanel .view-content').forEach(el => el.style.display = el.id === 'viewPositions' ? (view === 'positions' ? '' : 'none') : (view === 'transactions' ? '' : 'none'));
        document.querySelector('#posSearch').closest('.search-wrap').style.display = view === 'positions' ? '' : 'none';
        document.querySelector('.tx-controls').style.display = view === 'transactions' ? '' : 'none';
        const $ = PF.Utils.$;
        if (view === 'transactions') PF.UI.renderTransactions(PF.State.data.transactions, PF.State.periodFilter);
        if (view === 'positions') {
          const { positions, priceMap, fxRate, txAgg } = PF.App._getPositionsAndAgg();
          PF.UI.renderPositions(positions, priceMap, fxRate, txAgg);
        }
      });
    });

    $('posSearch').addEventListener('input', () => {
      PF.State._posSearch = $('posSearch').value;
      $('posSearchClear').classList.toggle('show', $('posSearch').value.length > 0);
      self._debounced('pos', () => {
        const { positions, priceMap, fxRate, txAgg } = PF.App._getPositionsAndAgg();
        PF.UI.renderPositions(positions, priceMap, fxRate, txAgg);
        PF.Charts.renderPie(positions, priceMap, fxRate, PF.State.chartMode);
      }, 120);
    });
    $('posSearchClear').addEventListener('click', () => {
      const inp = $('posSearch');
      inp.value = '';
      inp.dispatchEvent(new Event('input'));
      inp.focus();
    });
    $('txSearchClear').addEventListener('click', () => {
      const inp = $('txSearch');
      inp.value = '';
      inp.dispatchEvent(new Event('input'));
      inp.focus();
    });

    // Position table sort
    document.querySelectorAll('#posTable thead th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.key;
        if (PF.State.sortKey === key) PF.State.sortDir = -PF.State.sortDir;
        else { PF.State.sortKey = key; PF.State.sortDir = -1; }
        document.querySelectorAll('#posTable thead th.sortable').forEach(x => x.classList.remove('active', 'desc'));
        th.classList.add('active');
        if (PF.State.sortDir === 1) th.classList.add('desc');
        const { positions, priceMap, fxRate, txAgg } = PF.App._getPositionsAndAgg();
        PF.UI.renderPositions(positions, priceMap, fxRate, txAgg);
      });
    });

    $('manualLink').addEventListener('click', () => {
      PF.App._manualMode = true;
      $('modeSelect').style.display = 'none';
      $('modeManual').classList.add('show');
    });
    $('backToList').addEventListener('click', () => {
      PF.App._manualMode = false;
      $('modeSelect').style.display = 'block';
      $('modeManual').classList.remove('show');
    });

    // Sell modal
    $('sellClose').addEventListener('click', () => self._closeSell());
    $('sellCancel').addEventListener('click', () => self._closeSell());
    $('sellConfirm').addEventListener('click', () => self._confirmSell());
    $('sellQty').addEventListener('input', () => self._updateSellPreview());
    $('sellPrice').addEventListener('input', () => self._updateSellPreview());
    $('sellToUSDT').addEventListener('change', () => self._updateSellPreview());
    $('sellModal').addEventListener('click', (e) => { if (e.target === $('sellModal')) self._closeSell(); });

    // Edit modal
    $('editClose').addEventListener('click', () => self._closeEdit());
    $('editCancel').addEventListener('click', () => self._closeEdit());
    $('editConfirm').addEventListener('click', () => self._confirmEdit());
    $('editModal').addEventListener('click', (e) => { if (e.target === $('editModal')) self._closeEdit(); });

    // Collapse toggles
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.collapse-btn');
      if (!btn) return;
      const targetId = btn.dataset.target;
      const wrap = targetId ? PF.Utils.$(targetId) : btn.parentElement.nextElementSibling;
      if (!wrap) return;
      const isOpen = wrap.classList.toggle('open');
      btn.innerHTML = isOpen ? '\u25BC Masquer' : '\u25B6 D\u00e9tail';
    });

    // Toggle add position panel
    function toggleAddPanel(show) {
      var panel = $('addPanel');
      var isOpen = show != null ? show : panel.style.display === 'none';
      panel.style.display = isOpen ? 'block' : 'none';
      $('addPanelBtn').textContent = isOpen ? '\u2212 Fermer' : '+ Ajouter';
    }
    $('addPanelBtn').addEventListener('click', () => toggleAddPanel());
    $('closeAddPanelBtn').addEventListener('click', () => toggleAddPanel(false));

    // Toggle alerts panel
    function toggleAlertPanel(show) {
      var panel = $('posAlerts');
      var isOpen = show != null ? show : panel.style.display === 'none';
      panel.style.display = isOpen ? 'block' : 'none';
      $('alertPanelBtn').textContent = isOpen ? '\u2212 Fermer' : '+ Alerte';
    }
    $('alertPanelBtn').addEventListener('click', () => toggleAlertPanel());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); self.refreshPrices(); }
      if (e.key === 'i' || e.key === 'I') { e.preventDefault(); $('importFile').click(); }
      if (e.key === 'e' || e.key === 'E') { e.preventDefault(); self._exportCSV(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); self._undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); self._exportCSV(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') { e.preventDefault(); self._exportJSON(); }
      if (e.key === 'Escape') { self._closeSell(); self._closeEdit(); }
    });

    // Focus trap for modals
    PF.App._trapFocus = function(modal) {
      const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      modal._focusHandler = (e) => {
        if (e.key !== 'Tab') return;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      };
      document.addEventListener('keydown', modal._focusHandler);
      first?.focus();
    };

    PF.App._untrapFocus = function(modal) {
      if (modal._focusHandler) {
        document.removeEventListener('keydown', modal._focusHandler);
        modal._focusHandler = null;
      }
    };
  }
};
