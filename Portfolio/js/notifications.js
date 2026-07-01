window.PF = window.PF || {};

PF.Notifications = {
  _permission: 'default',
  _supported: typeof Notification !== 'undefined',

  init() {
    if (!PF.Notifications._supported) return;
    PF.Notifications._permission = Notification.permission;
  },

  async requestPermission() {
    if (!PF.Notifications._supported) return false;
    if (Notification.permission === 'granted') {
      PF.Notifications._permission = 'granted';
      return true;
    }
    if (Notification.permission === 'denied') {
      PF.Notifications._permission = 'denied';
      return false;
    }
    const result = await Notification.requestPermission();
    PF.Notifications._permission = result;
    return result === 'granted';
  },

  isSupported() {
    return PF.Notifications._supported;
  },

  getPermission() {
    return PF.Notifications._permission;
  },

  send(title, body, options) {
    if (!PF.Notifications._supported) return;
    if (Notification.permission !== 'granted') return;
    try {
      const notif = new Notification(title, {
        body: body,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">&#128176;</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">&#128176;</text></svg>',
        tag: options && options.tag || 'portfolio-alert',
        requireInteraction: false,
        silent: false
      });
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
      setTimeout(() => notif.close(), 8000);
    } catch (e) {
      console.warn('[Notifications] Failed to send:', e);
    }
  },

  sendAlert(symbol, direction, target, current, currency) {
    const arrow = direction === 'above' ? '\u2265' : '\u2264';
    const moneyFmt = PF.Utils.money(target, currency);
    const curFmt = PF.Utils.money(current, currency);
    PF.Notifications.send(
      `\uD83D\uDD14 Alerte ${symbol}`,
      `${symbol} a atteint ${curFmt} (${arrow} ${moneyFmt})`
    );
  }
};
