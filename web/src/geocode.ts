// Przybliżony adres dla AED bez adresu w danych — geokodowanie wsteczne Nominatim (OpenStreetMap).
// Zgodnie z zasadami Nominatim: tylko na żądanie użytkownika (otwarta karta AED / tryb ratunkowy),
// najwyżej 1 zapytanie na sekundę, wyniki zapamiętywane na urządzeniu.

const KEY = (lat: number, lon: number) => `aedostepni-adres:${lat.toFixed(5)},${lon.toFixed(5)}`;
let last = 0;

export async function reverseAddress(lat: number, lon: number): Promise<string> {
  try { const hit = localStorage.getItem(KEY(lat, lon)); if (hit !== null) return hit; } catch { /* brak dostępu */ }
  const wait = Math.max(0, last + 1100 - Date.now());
  if (wait) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}&zoom=18&addressdetails=1&accept-language=pl`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`Nominatim ${r.status}`);
  const j = await r.json();
  const a = j.address || {};
  const street = [a.road || a.pedestrian || a.square || a.footway, a.house_number].filter(Boolean).join(' ');
  const place = a.city || a.town || a.village || a.suburb || a.municipality || '';
  const out = [street, place].filter(Boolean).join(', ');
  try { localStorage.setItem(KEY(lat, lon), out); } catch { /* ignoruj */ }
  return out;
}

export interface AddressParts { street: string; house: string; postcode: string; city: string; }
const KEY2 = (lat: number, lon: number) => `aedostepni-adres2:${lat.toFixed(5)},${lon.toFixed(5)}`;

/** Jak reverseAddress, ale z rozbiciem na pola standardu (ulica, numer, kod pocztowy, miejscowość). */
export async function reverseParts(lat: number, lon: number): Promise<AddressParts> {
  try { const hit = localStorage.getItem(KEY2(lat, lon)); if (hit) return JSON.parse(hit); } catch { /* brak dostępu */ }
  const wait = Math.max(0, last + 1100 - Date.now());
  if (wait) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}&zoom=18&addressdetails=1&accept-language=pl`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`Nominatim ${r.status}`);
  const a = (await r.json()).address || {};
  const out: AddressParts = {
    street: a.road || a.pedestrian || a.square || a.footway || '', house: a.house_number || '', postcode: a.postcode || '',
    city: a.city || a.town || a.village || a.municipality || '',
  };
  try { localStorage.setItem(KEY2(lat, lon), JSON.stringify(out)); } catch { /* ignoruj */ }
  return out;
}
