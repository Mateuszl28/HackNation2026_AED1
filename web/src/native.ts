// Integracja z Androidem (Capacitor): skróty na ikonie, otwieranie linków w aplikacji, przycisk „wstecz”, pasek statusu.
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

/** Zamienia link (aedostepni://…, https://…/#/…) na trasę aplikacji. */
export function routeFromUrl(url: string): string | null {
  try {
    if (url.startsWith('aedostepni://')) {
      const rest = url.slice('aedostepni://'.length).replace(/^\/+/, '');
      if (rest.startsWith('ratunek')) return '/ratunek';
      if (rest.startsWith('najblizszy')) return '/?locate=1';
      if (rest.startsWith('aed/')) return '/' + rest;
      return '/';
    }
    const u = new URL(url);
    return u.hash.startsWith('#/') ? u.hash.slice(1) : '/';
  } catch {
    return null;
  }
}

const go = (route: string) => { window.location.hash = '#' + route; };

/** Zdarzenie „wstecz”: ekran może je przechwycić (np. zamknąć kartę AED) wywołując preventDefault(). */
export const BACK_EVENT = 'aedostepni:back';

export async function initNative() {
  if (!Capacitor.isNativePlatform()) return;

  // pasek statusu w kolorach aplikacji (biały, ciemne ikony)
  try { await StatusBar.setStyle({ style: Style.Light }); await StatusBar.setBackgroundColor({ color: '#FFFFFF' }); } catch { /* starszy Android */ }

  // link, którym uruchomiono aplikację (skrót SOS, kod QR) …
  try { const l = await App.getLaunchUrl(); const r = l?.url && routeFromUrl(l.url); if (r) go(r); } catch { /* brak */ }
  // … i linki otwierane, gdy aplikacja już działa
  App.addListener('appUrlOpen', ({ url }) => { const r = routeFromUrl(url); if (r) go(r); });

  // przycisk „wstecz”: najpierw zamyka otwarte elementy, potem cofa ekran, na mapie — chowa aplikację
  App.addListener('backButton', () => {
    const ev = new CustomEvent(BACK_EVENT, { cancelable: true });
    window.dispatchEvent(ev);
    if (ev.defaultPrevented) return;
    const path = window.location.hash.replace(/^#/, '').split('?')[0] || '/';
    if (path !== '/') { if (window.history.length > 1) window.history.back(); else go('/'); }
    else App.minimizeApp();
  });
}
