// Lokalizacja AKTUALNA, nie zapamiętana.
// - W aplikacji Android używamy natywnej lokalizacji (Fused Location / GPS) przez Capacitor Geolocation —
//   lokalizacja WebView potrafi oddać starą pozycję z sieci (±100–500 m, nawet z innego miasta).
// - W przeglądarce: Geolocation API z maximumAge: 0.
// - W obu przypadkach odrzucamy odczyty starsze niż 30 s (bufor systemu) — liczy się tylko świeża pozycja.
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export interface Fix { lat: number; lon: number; acc: number; ts: number; }
export type GeoErr = 'denied' | 'unavailable' | 'timeout';

const FRESH_MS = 30_000;
const OPTS = { enableHighAccuracy: true, timeout: 25_000, maximumAge: 0 };

/** Śledzi świeżą pozycję. Zwraca funkcję zatrzymującą śledzenie. */
export function watchFresh(onFix: (f: Fix) => void, onErr: (e: GeoErr) => void): () => void {
  const accept = (lat: number, lon: number, acc: number | null | undefined, ts: number) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    if (Date.now() - ts > FRESH_MS) return; // pozycja zapamiętana przez system — czekamy na nową
    onFix({ lat, lon, acc: Math.round(acc || 9999), ts });
  };

  if (Capacitor.isNativePlatform()) {
    let id: string | null = null;
    let stopped = false;
    (async () => {
      try {
        const p = await Geolocation.checkPermissions();
        if (p.location !== 'granted') {
          const r = await Geolocation.requestPermissions({ permissions: ['location'] });
          if (r.location !== 'granted') { onErr('denied'); return; }
        }
      } catch { onErr('unavailable'); return; }
      if (stopped) return;
      id = await Geolocation.watchPosition(OPTS, (pos, err) => {
        if (err || !pos) { onErr(/denied|permission/i.test(String((err as { message?: string })?.message || '')) ? 'denied' : 'unavailable'); return; }
        accept(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, pos.timestamp);
      });
      if (stopped && id) Geolocation.clearWatch({ id });
    })();
    return () => { stopped = true; if (id) Geolocation.clearWatch({ id }); };
  }

  if (!navigator.geolocation) { onErr('unavailable'); return () => {}; }
  const wid = navigator.geolocation.watchPosition(
    (p) => accept(p.coords.latitude, p.coords.longitude, p.coords.accuracy, p.timestamp),
    (e) => onErr(e.code === 1 ? 'denied' : e.code === 3 ? 'timeout' : 'unavailable'),
    OPTS,
  );
  return () => navigator.geolocation.clearWatch(wid);
}
