window.PF = window.PF || {};

PF.Crypto = {
  _key: null,
  _salt: null,
  STORAGE_KEY: 'pf_encrypted_v1',
  SALT_KEY: 'pf_salt',
  RECOVERY_KEY_STORAGE: 'pf_recovery_key',

  async init() {
    const rawSalt = localStorage.getItem(PF.Crypto.SALT_KEY);
    if (rawSalt) {
      PF.Crypto._salt = new Uint8Array(JSON.parse(rawSalt));
    } else {
      PF.Crypto._salt = crypto.getRandomValues(new Uint8Array(16));
      localStorage.setItem(PF.Crypto.SALT_KEY, JSON.stringify([...PF.Crypto._salt]));
    }
  },

  generateRecoveryKey() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  },

  async saveRecoveryKey(recoveryKey, password) {
    const encrypted = await PF.Crypto.encrypt({ recoveryKey }, password);
    localStorage.setItem(PF.Crypto.RECOVERY_KEY_STORAGE, encrypted);
  },

  async unlockWithRecoveryKey(recoveryKey) {
    const raw = localStorage.getItem(PF.Crypto.RECOVERY_KEY_STORAGE);
    if (!raw) return false;
    try {
      const key = recoveryKey.replace(/\s/g, '').toUpperCase();
      const encryptedData = localStorage.getItem(PF.Crypto.STORAGE_KEY);
      if (!encryptedData) return false;
      const { iv, data } = JSON.parse(encryptedData);
      const salt = PF.Crypto._salt;

      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(key),
        'PBKDF2',
        false,
        ['deriveKey']
      );
      const derivedKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        derivedKey,
        new Uint8Array(data)
      );
      return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (e) {
      console.warn('[Crypto] Recovery key failed:', e);
      return null;
    }
  },

  async deriveKey(password) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: PF.Crypto._salt, iterations: 310000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  async encrypt(data, password) {
    const key = await PF.Crypto.deriveKey(password);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(JSON.stringify(data))
    );
    return JSON.stringify({
      iv: [...iv],
      data: [...new Uint8Array(ciphertext)]
    });
  },

  async decrypt(cipherJSON, password) {
    const { iv, data } = JSON.parse(cipherJSON);
    const key = await PF.Crypto.deriveKey(password);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      new Uint8Array(data)
    );
    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted));
  },

  async save(data, password) {
    if (!password) return false;
    try {
      const encrypted = await PF.Crypto.encrypt(data, password);
      localStorage.setItem(PF.Crypto.STORAGE_KEY, encrypted);
      localStorage.removeItem(PF.Utils.LS_KEY);
      return true;
    } catch (e) {
      console.error('[Crypto] Save failed:', e);
      return false;
    }
  },

  async load(password) {
    if (!password) return null;
    try {
      const raw = localStorage.getItem(PF.Crypto.STORAGE_KEY);
      if (!raw) return null;
      return await PF.Crypto.decrypt(raw, password);
    } catch (e) {
      console.warn('[Crypto] Decryption failed (wrong password?)');
      return null;
    }
  },

  hasEncryptedData() {
    return !!localStorage.getItem(PF.Crypto.STORAGE_KEY);
  },

  async changePassword(oldPassword, newPassword) {
    const data = await PF.Crypto.load(oldPassword);
    if (!data) return false;
    return PF.Crypto.save(data, newPassword);
  },

  exportUnencrypted(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'portfolio_unencrypted_' + PF.Utils.todayISO() + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }
};
