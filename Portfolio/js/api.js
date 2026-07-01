window.PF = window.PF || {};

PF.API = {
  coins: [],
  priceMap: {},
  fxRate: 1,
  priceHistory: {},
  _histTimestamps: {},
  _lastFetch: 0,
  _abort: null,
  _pending: null,
  _histPending: null,

  PRICE_CACHE_KEY: 'pf_price_cache',
  PRICE_CACHE_TS_KEY: 'pf_price_cache_ts',

  getPriceMap() { return PF.API.priceMap; },
  getFxRate() { return PF.API.fxRate; },
  getCoins() { return PF.API.coins; },

  loadCachedPrices() {
    try {
      const raw = localStorage.getItem(PF.API.PRICE_CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        PF.API.coins = cached.coins || [];
        PF.API.priceMap = cached.priceMap || {};
        PF.API.fxRate = cached.fxRate || 1;
        PF.API._lastFetch = parseInt(localStorage.getItem(PF.API.PRICE_CACHE_TS_KEY) || '0', 10);
        return PF.API.coins.length > 0;
      }
    } catch (e) { console.warn('[API] Cache load failed:', e); }
    return false;
  },

  saveCachedPrices() {
    try {
      localStorage.setItem(PF.API.PRICE_CACHE_KEY, JSON.stringify({
        coins: PF.API.coins,
        priceMap: PF.API.priceMap,
        fxRate: PF.API.fxRate
      }));
      localStorage.setItem(PF.API.PRICE_CACHE_TS_KEY, String(PF.API._lastFetch));
    } catch (e) { console.warn('[API] Cache save failed:', e); }
  },

  isOffline() {
    return !navigator.onLine;
  },

  getCacheAge() {
    if (!PF.API._lastFetch) return null;
    return Date.now() - PF.API._lastFetch;
  },

  async fetchCoins(force) {
    if (!force && PF.API._lastFetch && Date.now() - PF.API._lastFetch < 30000) return;
    if (PF.API._pending) return PF.API._pending;

    PF.API._pending = PF.API._doFetch();
    try { await PF.API._pending; } finally { PF.API._pending = null; }
  },

  async _doFetch() {
    const cur = PF.State.data.currency;
    let controller = new AbortController();
    PF.API._abort = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      PF.API.coins = [];
      PF.API.priceMap = {};
      let page = 1;
      while (page <= 2) {
        const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${cur}&order=market_cap_desc&per_page=100&page=${page}&sparkline=false`;
        let res;
        try { res = await fetch(url, { signal: controller.signal }); } catch (e) { break; }
        if (!res.ok) {
          if (res.status === 429 && PF.API.coins.length) break;
          if (res.status === 429) { await new Promise(r => setTimeout(r, 2000)); continue; }
          throw new Error('HTTP ' + res.status);
        }
        const data = await res.json();
        if (!data || !data.length) break;
        for (let i = 0; i < data.length; i++) {
          const c = data[i];
          const coin = {
            id: c.id, symbol: (c.symbol || '').toUpperCase(), name: c.name,
            image: c.image, price: c.current_price, change24h: c.price_change_percentage_24h
          };
          PF.API.coins.push(coin);
          PF.API.priceMap[c.id] = coin;
        }
        page++;
        if (page <= 2) await new Promise(r => setTimeout(r, 500));
      }
      PF.API.fxRate = cur === 'usd' ? 1 : (PF.API.priceMap['tether'] ? PF.API.priceMap['tether'].price : 1);
      if (PF.Engine._invalidateCache) PF.Engine._invalidateCache();
      await PF.API._backfillHeldPrices();
      PF.API.saveCachedPrices();
    } finally {
      clearTimeout(timeout);
      PF.API._abort = null;
      PF.API._lastFetch = Date.now();
    }
  },

  async _backfillHeldPrices() {
    const positions = PF.Engine.computePositions(
      PF.State.data.transactions, PF.State.data.manualCoins,
      PF.API.priceMap, PF.API.fxRate
    );
    const heldIds = [];
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      if (!p.manual && p.coinId && !PF.API.priceMap[p.coinId]) {
        heldIds.push(PF.State.SYMBOL_TO_ID[p.symbol] || p.coinId);
      }
    }
    if (!heldIds.length) return;
    const idsParam = [...new Set(heldIds)].join(',');
    const cur = PF.State.data.currency;
    let res;
    try {
      res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=${cur}&ids=${idsParam}&sparkline=false`);
    } catch (e) { return; }
    if (!res.ok) return;
    const data = await res.json();
    for (let i = 0; i < data.length; i++) {
      const c = data[i];
      const obj = {
        id: c.id, symbol: (c.symbol || '').toUpperCase(), name: c.name,
        image: c.image, price: c.current_price, change24h: c.price_change_percentage_24h
      };
      PF.API.priceMap[c.id] = obj;
      if (!PF.API.coins.some(x => x.id === c.id)) PF.API.coins.push(obj);
    }
  },

  _CORS_PROXIES: [
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url=',
  ],

  async _fetchWithProxy(url, signal) {
    try {
      const res = await fetch(url, { signal });
      if (res.ok) return res;
    } catch (e) {
      if (e.name === 'AbortError') throw e;
    }
    for (let i = 0; i < PF.API._CORS_PROXIES.length; i++) {
      try {
        const proxyUrl = PF.API._CORS_PROXIES[i] + encodeURIComponent(url);
        const res = await fetch(proxyUrl, { signal });
        if (res.ok) return res;
      } catch (e) {
        if (e.name === 'AbortError') throw e;
      }
    }
    return fetch(url, { signal });
  },

  async fetchPriceHistory(onProgress) {
    const positions = PF.Engine.computePositions(
      PF.State.data.transactions, PF.State.data.manualCoins,
      PF.API.priceMap, PF.API.fxRate
    );
    const coinIds = [];
    const seen = new Set();
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      if (!p.manual && p.coinId && !seen.has(p.coinId)) {
        seen.add(p.coinId);
        if (PF.API._isCoinHistoryStale(p.coinId)) coinIds.push(p.coinId);
      }
    }
    // Include coins from ALL transactions (sold coins too)
    for (let i = 0; i < PF.State.data.transactions.length; i++) {
      const coinId = PF.API.resolveCoinId(PF.State.data.transactions[i].symbol);
      if (coinId && !seen.has(coinId)) {
        seen.add(coinId);
        if (PF.API._isCoinHistoryStale(coinId)) coinIds.push(coinId);
      }
    }
    console.log('[History] Coins needing fetch:', coinIds.length, coinIds);
    if (!coinIds.length) { console.log('[History] All up to date'); return; }
    const cur = PF.State.data.currency;
    let loaded = 0, failed = 0;
    for (let i = 0; i < coinIds.length; i++) {
      const id = coinIds[i];
      let success = false;
      for (let attempt = 0; attempt < 3 && !success; attempt++) {
        try {
          const url = `https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=${cur}&days=365`;
          const res = await PF.API._fetchWithProxy(url);
          if (res.status === 429) {
            const wait = Math.pow(2, attempt + 1) * 2000;
            console.warn('[History] Rate limited ' + id + ', waiting ' + (wait/1000) + 's (attempt ' + (attempt+1) + '/3)');
            await new Promise(r => setTimeout(r, wait));
            continue;
          }
          if (!res.ok) { console.warn('[History] HTTP ' + res.status + ' for ' + id); break; }
          const data = await res.json();
          if (data && Array.isArray(data) && data.length) {
            const map = {};
            for (let j = 0; j < data.length; j++) {
              const d = new Date(data[j][0]).toISOString().slice(0, 10);
              map[d] = data[j][4]; // OHLC: close price
            }
            PF.API.priceHistory[id] = map;
            PF.API._histTimestamps[id] = Date.now();
            success = true;
            loaded++;
          }
        } catch (e) {
          console.warn('[History] Network error for ' + id + ': ' + e.message);
          if (attempt < 2) await new Promise(r => setTimeout(r, 3000));
        }
      }
      if (!success) failed++;
      if (typeof onProgress === 'function') {
        onProgress({ loaded: loaded, failed: failed, total: coinIds.length, current: id, done: i + 1 });
      }
      if (i < coinIds.length - 1) await new Promise(r => setTimeout(r, 2100));
    }
    PF.API.savePriceHistory();
    console.log('[History] Done: ' + loaded + ' loaded, ' + failed + ' failed out of ' + coinIds.length);
    return { loaded: loaded, failed: failed, total: coinIds.length };
  },

  _isCoinHistoryStale(coinId) {
    const ts = PF.API._histTimestamps[coinId];
    if (!ts) return true;
    return Date.now() - ts > 86400000; // 24h per coin
  },

  resolveCoinId(symbol) {
    if (!symbol) return '';
    const mapped = PF.State.SYMBOL_TO_ID[symbol];
    if (mapped) return mapped;
    const found = PF.API.coins.find(c => c.symbol === symbol);
    return found ? found.id : '';
  },

  getHistoricalPrice(coinId, date, fallbackPrice) {
    const hist = PF.API.priceHistory[coinId];
    if (!hist) return fallbackPrice || null;
    const exact = hist[date];
    if (exact != null) return exact;
    const dates = Object.keys(hist).sort();
    for (let i = dates.length - 1; i >= 0; i--) {
      if (dates[i] <= date) return hist[dates[i]];
    }
    return fallbackPrice || hist[dates[0]] || null;
  },

  savePriceHistory() {
    try {
      localStorage.setItem('pf_price_history', JSON.stringify(PF.API.priceHistory));
      localStorage.setItem('pf_price_history_ts', JSON.stringify(PF.API._histTimestamps));
    } catch (e) {
      console.warn('[API] Impossible de sauvegarder l\'historique (quota dépassé ?)', e.message);
      if (PF.UI && PF.UI.toast) PF.UI.toast('Espace localStorage insuffisant pour l\'historique', 'err');
    }
  },

  loadPriceHistory() {
    try {
      const raw = localStorage.getItem('pf_price_history');
      if (raw) PF.API.priceHistory = JSON.parse(raw);
      const ts = localStorage.getItem('pf_price_history_ts');
      if (ts) PF.API._histTimestamps = JSON.parse(ts);
    } catch (e) {}
  },


};
