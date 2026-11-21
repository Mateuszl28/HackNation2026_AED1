// Trasa piesza do AED (OSRM, profil „foot”, serwer FOSSGIS na danych OpenStreetMap).
// Tylko na żądanie (wybrany AED + znana lokalizacja), jedna trasa naraz, wyniki zapamiętywane w pamięci.
// Bez internetu lub przy błędzie zwracamy null — aplikacja wraca do szacunku (linia prosta × 1,3).

export interface WalkRoute { distance: number; coords: [number, number][]; }

const cache = new Map<string, WalkRoute | null>();
let ctrl: AbortController | null = null;

export async function walkRoute(from: [number, number], to: [number, number]): Promise<WalkRoute | null> {
  const key = `${from[0].toFixed(4)},${from[1].toFixed(4)}>${to[0].toFixed(5)},${to[1].toFixed(5)}`;
  if (cache.has(key)) return cache.get(key)!;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
  ctrl?.abort();
  ctrl = new AbortController();
  const timer = setTimeout(() => ctrl?.abort(), 6000);
  try {
    const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    const rt = j.routes?.[0];
    const out: WalkRoute | null = rt ? { distance: rt.distance, coords: (rt.geometry.coordinates as [number, number][]).map(([lon, lat]) => [lat, lon]) } : null;
    cache.set(key, out);
    return out;
  } catch {
    return null; // przerwane lub brak sieci — nie zapamiętujemy, spróbujemy przy następnym wyborze
  } finally {
    clearTimeout(timer);
  }
}
