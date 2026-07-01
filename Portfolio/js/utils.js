window.PF = window.PF || {};

PF.Utils = {
  LS_KEY: 'crypto_portfolio_v3',

  $(id) { return document.getElementById(id); },

  fmt(n, d) {
    if (n == null || isNaN(n)) return '\u2014';
    d = d === undefined ? 2 : d;
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  },

  curSym(cur) { return cur === 'eur' ? '\u20AC' : '$'; },

  money(n, cur) {
    const s = PF.Utils.fmt(n);
    return cur === 'eur' ? (s + ' \u20AC') : ('$' + s);
  },

  fmtDate(iso) {
    if (!iso) return '\u2014';
    const p = String(iso).split(' ')[0].split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
  },

  todayISO() { return new Date().toISOString().slice(0, 10); },

  num(s) { return parseFloat(String(s).replace(/,/g, '').trim()) || 0; },

  escapeHtml(s) {
    if (!s) return '';
    const str = String(s);
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;' };
    return str.replace(/[&<>"'\/`]/g, c => map[c]);
  },

  escapeJS(s) {
    if (!s) return '';
    return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'\\"').replace(/</g,'\\x3c').replace(/>/g,'\\x3e');
  },

  isValidDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return false;
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const y = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const d = parseInt(match[3], 10);
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  },

  isValidSymbol(sym) {
    if (!sym || typeof sym !== 'string') return false;
    const trimmed = sym.trim().toUpperCase();
    return trimmed.length >= 1 && trimmed.length <= 10 && /^[A-Z0-9]+$/.test(trimmed);
  },

  isValidAmount(val) {
    const n = parseFloat(val);
    return !isNaN(n) && isFinite(n) && n > 0 && n < 1e15;
  },

  isValidPrice(val) {
    const n = parseFloat(val);
    return !isNaN(n) && isFinite(n) && n >= 0 && n < 1e12;
  },

  isValidFees(val) {
    if (val === '' || val === null || val === undefined) return true;
    const n = parseFloat(val);
    return !isNaN(n) && isFinite(n) && n >= 0 && n < 1e10;
  },

  sanitizeString(str, maxLen) {
    if (!str || typeof str !== 'string') return '';
    let s = str.trim();
    if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
    return s;
  },

  sanitizeTags(raw) {
    if (!raw || typeof raw !== 'string') return [];
    return raw.split(',')
      .map(s => s.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30))
      .filter(s => s.length > 0)
      .slice(0, 20);
  },

  safeAttr(str) {
    if (!str) return '';
    return String(str).replace(/[^a-zA-Z0-9_\-:.\/]/g, '');
  },

  isSafeUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    return trimmed.startsWith('https://') || trimmed.startsWith('data:image/');
  },

  PALETTE: ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#ef4444', '#14b8a6', '#eab308', '#3b82f6', '#f97316', '#a855f7', '#10b981', '#64748b', '#84cc16']
};
