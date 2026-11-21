// Przypisanie AED do województw (point-in-polygon) i statystyki „mapy luk w danych”.
// Granice: uproszczony GeoJSON województw (github.com/ppatrzyk/polska-geojson, na podstawie danych PRG/GUGiK).
// Ludność: GUS, stan na 31.12.2023 (w tys., zaokrąglone) — wyłącznie do wskaźnika „AED na 100 tys. mieszkańców”.

import { readFileSync } from 'node:fs';

export const WOJ: Record<string, { terc: string; ludnosc_tys: number }> = {
  'dolnośląskie': { terc: '02', ludnosc_tys: 2877 }, 'kujawsko-pomorskie': { terc: '04', ludnosc_tys: 2004 },
  'lubelskie': { terc: '06', ludnosc_tys: 2039 }, 'lubuskie': { terc: '08', ludnosc_tys: 975 },
  'łódzkie': { terc: '10', ludnosc_tys: 2389 }, 'małopolskie': { terc: '12', ludnosc_tys: 3430 },
  'mazowieckie': { terc: '14', ludnosc_tys: 5516 }, 'opolskie': { terc: '16', ludnosc_tys: 944 },
  'podkarpackie': { terc: '18', ludnosc_tys: 2080 }, 'podlaskie': { terc: '20', ludnosc_tys: 1162 },
  'pomorskie': { terc: '22', ludnosc_tys: 2357 }, 'śląskie': { terc: '24', ludnosc_tys: 4349 },
  'świętokrzyskie': { terc: '26', ludnosc_tys: 1177 }, 'warmińsko-mazurskie': { terc: '28', ludnosc_tys: 1381 },
  'wielkopolskie': { terc: '30', ludnosc_tys: 3480 }, 'zachodniopomorskie': { terc: '32', ludnosc_tys: 1646 },
};

type Ring = [number, number][];
interface Region { name: string; polys: Ring[][]; bbox: [number, number, number, number]; }

export function loadRegions(path: string): { regions: Region[]; geojson: any } {
  const gj = JSON.parse(readFileSync(path, 'utf8'));
  const regions: Region[] = gj.features.map((f: any) => {
    const polys: Ring[][] = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const all = polys.flat(2) as unknown as number[];
    const xs = polys.flatMap((p) => p[0].map((c) => c[0])), ys = polys.flatMap((p) => p[0].map((c) => c[1]));
    void all;
    return { name: String(f.properties.nazwa).toLowerCase(), polys, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
  });
  return { regions, geojson: gj };
}

function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function regionOf(regions: Region[], lon: number, lat: number): string {
  for (const r of regions) {
    const [a, b, c, d] = r.bbox;
    if (lon < a || lon > c || lat < b || lat > d) continue;
    for (const poly of r.polys) if (inRing(lon, lat, poly[0]) && !poly.slice(1).some((h) => inRing(lon, lat, h))) return r.name;
  }
  return '';
}

export interface RegionStats {
  wojewodztwo: string; terc: string; aed: number; na_100_tys: number; z_godzinami_pct: number; z_opisem_pct: number;
  z_kontrola_pct: number; od_dysponentow_pct: number; zbiory_dysponentow: number; srednia_jakosc: number; indeks_gotowosci: number;
}

export function regionStats(records: Record<string, string>[]): RegionStats[] {
  const by = new Map<string, Record<string, string>[]>();
  for (const r of records) { if (!r.wojewodztwo) continue; if (!by.has(r.wojewodztwo)) by.set(r.wojewodztwo, []); by.get(r.wojewodztwo)!.push(r); }
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
  return Object.entries(WOJ).map(([name, w]) => {
    const rs = by.get(name) || [];
    const n = rs.length;
    const godz = pct(rs.filter((r) => r.godziny_dostepnosci).length, n);
    const opis = pct(rs.filter((r) => r.opis_lokalizacji).length, n);
    const kontr = pct(rs.filter((r) => r.data_ostatniej_kontroli).length, n);
    const dysp = pct(rs.filter((r) => /(^|\|)dgp-/.test(r.zrodla)).length, n);
    const zbiory = new Set(rs.flatMap((r) => r.zrodla.split('|').filter((s) => s.startsWith('dgp-')).map((s) => s.split(':')[0]))).size;
    // Indeks gotowości danych (0–100): czy ratujący dowie się, GDZIE dokładnie, KIEDY dostępny i CZY sprawny, oraz czy dane pochodzą od dysponenta.
    const indeks = Math.round(0.3 * godz + 0.3 * opis + 0.2 * kontr + 0.2 * dysp);
    return {
      wojewodztwo: name, terc: w.terc, aed: n, na_100_tys: Math.round(((n * 100) / w.ludnosc_tys) * 10) / 10,
      z_godzinami_pct: godz, z_opisem_pct: opis, z_kontrola_pct: kontr, od_dysponentow_pct: dysp, zbiory_dysponentow: zbiory,
      srednia_jakosc: n ? Math.round(rs.reduce((s, r) => s + Number(r.jakosc), 0) / n) : 0, indeks_gotowosci: indeks,
    };
  }).sort((a, b) => b.indeks_gotowosci - a.indeks_gotowosci);
}
