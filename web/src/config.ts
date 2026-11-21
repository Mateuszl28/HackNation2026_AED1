// Publiczny adres wersji web — używany w linkach udostępnianych z aplikacji Android i w kodach QR.
export const PUBLIC_URL = 'https://mateuszl28.github.io/HackNation2026_AED1/';

const isNative = () => typeof location !== 'undefined' && (location.hostname === 'localhost' && !location.port);

/** Bazowy adres do linków: w przeglądarce — bieżący adres strony, w aplikacji natywnej — adres publiczny. */
export function appBase(): string {
  if (typeof location === 'undefined' || isNative()) return PUBLIC_URL;
  return location.origin + location.pathname;
}

/** Link do konkretnego AED (po identyfikatorze) albo do miejsca (@lat,lon → najbliższy AED). */
export function aedLink(ref: string | { lat: number; lon: number }): string {
  const id = typeof ref === 'string' ? ref : `@${ref.lat.toFixed(6)},${ref.lon.toFixed(6)}`;
  return `${appBase()}#/aed/${encodeURIComponent(id)}`;
}
