window.PF = window.PF || {};

PF.State = {
  data: {
    transactions: [],
    manualCoins: {},
    alerts: [],
    history: [],
    currency: 'usd',
    theme: 'dark'
  },

  sortKey: 'value',
  sortDir: -1,
  periodFilter: 'all',
  chartMode: 'value',
  _chartView: 'holdings',
  _posSearch: '',
  _txSearch: '',
  _txTypeFilter: 'all',
  _txPage: 1,
  _txView: 'positions',
  PAGE_SIZE: 20,

  _undoStack: [],
  MAX_UNDO: 30,

  SYMBOL_TO_ID: {
    USDT: 'tether', ETH: 'ethereum', BTC: 'bitcoin', TAO: 'bittensor', SOL: 'solana', NEAR: 'near',
    ETHFI: 'ether-fi', HYPE: 'hyperliquid', GNO: 'gnosis', CRO: 'crypto-com-chain', AAVE: 'aave',
    ATOM: 'cosmos', LINK: 'chainlink', VET: 'vechain', NEO: 'neo', USDC: 'usd-coin'
  },

  async load(password) {
    if (password && PF.Crypto && PF.Crypto.hasEncryptedData()) {
      const decrypted = await PF.Crypto.load(password);
      if (decrypted) {
        PF.State.data = decrypted;
        PF.State._password = password;
      } else {
        return false;
      }
    } else {
      try {
        const raw = localStorage.getItem(PF.Utils.LS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          PF.State.data = parsed;
        }
      } catch (e) { console.warn(e);       }
    }
    await PF.State._migrate();
    if (PF.State.data.theme === 'light') document.body.classList.add('light');
    return true;
  },

  async save() {
    try {
      if (PF.State._password && PF.Crypto) {
        await PF.Crypto.save(PF.State.data, PF.State._password);
      } else {
        localStorage.setItem(PF.Utils.LS_KEY, JSON.stringify(PF.State.data));
      }
    } catch (e) {
      console.warn('[State] Impossible de sauvegarder (quota dépassé ?)', e.message);
      PF.UI.toast('Espace localStorage insuffisant - sauvegarde impossible', 'err');
    }
  },

  pushUndo(label) {
    var snap = JSON.parse(JSON.stringify(PF.State.data));
    PF.State._undoStack.push({ label: label || 'Action', data: snap });
    if (PF.State._undoStack.length > PF.State.MAX_UNDO) PF.State._undoStack.shift();
    var btn = PF.Utils.$('undoBtn');
    if (btn) { btn.style.display = ''; btn.title = 'Annuler : ' + label; }
  },

  popUndo() {
    if (!PF.State._undoStack.length) return null;
    var entry = PF.State._undoStack.pop();
    return { data: JSON.parse(JSON.stringify(entry.data)), label: entry.label };
  },

  TX_TYPES: ['buy','sell','transfer_in','transfer_out','swap','staking_reward','airdrop'],

  TX_TYPE_LABELS: {
    buy: 'Achat', sell: 'Vente',
    transfer_in: 'Transfert entrant', transfer_out: 'Transfert sortant',
    swap: 'Swap', staking_reward: 'Staking reward', airdrop: 'Airdrop'
  },

  TX_TYPE_COLORS: {
    buy: 'pos', sell: 'neg',
    transfer_in: 'pos', transfer_out: 'neg',
    swap: 'amber', staking_reward: 'pos', airdrop: 'pos'
  },

  async _migrate() {
    const d = PF.State.data;
    if (!d.transactions) d.transactions = [];
    if (!d.manualCoins) d.manualCoins = {};
    if (!d.alerts) d.alerts = [];
    if (!d.history) d.history = [];
    if (!d.currency) d.currency = 'usd';
    if (!d.theme) d.theme = 'dark';

    // Migration v3 -> v4: add new fields to existing transactions
    d.transactions.forEach(t => {
      if (t.fees == null) t.fees = 0;
      if (!t.notes) t.notes = '';
      if (!t.tags) t.tags = [];
      // Map legacy 'buy'/'sell' with swapFromUSDT to proper swap type
      // (kept as-is for backward compat)
    });

    // Migration v3: old format with stored positions -> transactions
    if (d.positions && d.positions.length > 0 && d.transactions.length === 0) {
      d.transactions = d.positions.map(p => ({
        date: p.date || PF.Utils.todayISO(),
        symbol: p.symbol,
        type: 'buy',
        price: (p.buyPriceUSD || 0) * (d.currency === 'eur' ? (p._fxRate || 1) : 1),
        amount: p.qty,
        fees: 0, notes: '', tags: []
      }));
      // Convert manual positions to manualCoins
      d.positions.forEach(p => {
        if (p.manual && p.symbol) {
          d.manualCoins[p.symbol] = { name: p.name || p.symbol, priceUSD: p.manualPriceUSD || 0 };
        }
      });
      delete d.positions;
      await PF.State.save();
    }
  },

  async seed() {
    const d = PF.State.data;
    if (d.transactions.length > 0) return;

    const SEED_TRANSACTIONS = [
      { date: '2024-12-16', symbol: 'USDT', type: 'buy', price: 0.9999, amount: 182030.96 },
      { date: '2023-08-12', symbol: 'ETH', type: 'buy', price: 1838.55, amount: 73.00 },
      { date: '2023-08-18', symbol: 'BTC', type: 'buy', price: 36056.92, amount: 1.7830 },
      { date: '2024-02-04', symbol: 'TAO', type: 'buy', price: 276.92, amount: 20.00 },
      { date: '2024-01-25', symbol: 'SOL', type: 'buy', price: 112.40, amount: 55.00 },
      { date: '2023-09-07', symbol: 'NEAR', type: 'buy', price: 2.8689, amount: 1745.90 },
      { date: '2024-04-21', symbol: 'ETHFI', type: 'buy', price: 0.3936, amount: 6071.00 },
      { date: '2024-03-25', symbol: 'HYPE', type: 'buy', price: 40.26, amount: 23.00 },
      { date: '2024-04-09', symbol: 'GNO', type: 'buy', price: 95.91, amount: 10.00 },
      { date: '2023-08-12', symbol: 'CRO', type: 'buy', price: 0.0572, amount: 18000.00 },
      { date: '2024-06-18', symbol: 'AAVE', type: 'buy', price: 76.02, amount: 10.00 },
      { date: '2024-07-07', symbol: 'ATOM', type: 'buy', price: 6.0248, amount: 369.14 },
      { date: '2024-03-20', symbol: 'LINK', type: 'buy', price: 14.76, amount: 65.22 },
      { date: '2021-11-19', symbol: 'VET', type: 'buy', price: 0.05918, amount: 80000.00 },
      { date: '2023-11-06', symbol: 'NEO', type: 'buy', price: 12.50, amount: 50.00 }
    ];
    d.transactions = SEED_TRANSACTIONS;
    await PF.State.save();
  }
};
