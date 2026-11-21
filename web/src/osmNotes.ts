// Zgłoszenia bez własnego serwera: publiczne notatki w OpenStreetMap (API 0.6, anonimowo).
// Notatka pojawia się na mapie OSM w miejscu AED; wolontariusze-maperzy weryfikują ją i poprawiają dane,
// a poprawka trafia do zbioru krajowego przy najbliższej nocnej synchronizacji (OpenAEDMap → pipeline).
// Tryb testowy (`osmdev`) wysyła do piaskownicy OSM, a nie na produkcyjną mapę.

export interface OsmNote { id: number; url: string; }

export function osmEndpoints(dev: boolean) {
  return dev
    ? { api: 'https://master.apis.dev.openstreetmap.org', web: 'https://master.apis.dev.openstreetmap.org' }
    : { api: 'https://api.openstreetmap.org', web: 'https://www.openstreetmap.org' };
}

export async function createOsmNote(lat: number, lon: number, text: string, dev = false): Promise<OsmNote> {
  const { api, web } = osmEndpoints(dev);
  const body = new URLSearchParams({ lat: lat.toFixed(7), lon: lon.toFixed(7), text });
  const r = await fetch(`${api}/api/0.6/notes.json`, { method: 'POST', body });
  if (!r.ok) throw new Error(`OpenStreetMap odpowiedział błędem ${r.status}`);
  const j = await r.json();
  const id = Number(j?.properties?.id);
  if (!id) throw new Error('Nieoczekiwana odpowiedź OpenStreetMap');
  return { id, url: `${web}/note/${id}` };
}
