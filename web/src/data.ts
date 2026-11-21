import { isOpenAt, is247 } from '@shared/hours.ts';

export interface Aed {
  aed_uid: string; lat: number; lon: number; nazwa: string; opis_lokalizacji: string; nazwa_ulicy: string; nr_budynku: string;
  miejscowosc: string; godziny_dostepnosci: string; dostep: string; zabezpieczenie: string; dysponent: string; telefon_kontaktowy: string;
  data_ostatniej_kontroli: string; zrodla: string; jakosc: string; kondygnacja: string; wewnatrz_budynku: string; zdjecie_url: string;
  stan: string; elektrody_dzieciece: string; instrukcja_dostepu: string;
}

export type Availability = 'open' | 'closed' | 'unknown';

export const BYDGOSZCZ: [number, number] = [53.1235, 18.0084];

let cache: Promise<Aed[]> | null = null;
export function loadAeds(): Promise<Aed[]> {
  if (!cache) {
    cache = fetch('./data/aed-app.json').then((r) => r.json()).then((d: { cols: string[]; rows: unknown[][]; sources: typeof SOURCES }) => {
      Object.assign(SOURCES, d.sources || {});
      return d.rows.map((row) => {
        const o: Record<string, unknown> = {};
        d.cols.forEach((c, i) => { o[c] = row[i]; });
        o.lat = o.szerokosc_geograficzna; o.lon = o.dlugosc_geograficzna;
        return o as unknown as Aed;
      });
    });
  }
  return cache;
}

export interface Stats {
  data_wygenerowania: string; liczba_aed: number; z_wieloma_zrodlami: number; calodobowe: number; bez_godzin: number;
  bez_opisu_lokalizacji: number; publiczne: number; z_data_kontroli: number; srednia_jakosc: number; wersja_standardu: string;
  zrodla: {
    id: string; title: string; publisher: string; kind: string; license: string; url: string; format: string; rows: number; valid: number;
    rejected: number; rejectedExamples: string[]; matchedExisting: number; newRecords: number; autoFixes: Record<string, number>; topIssues: Record<string, number>;
    mapping: Record<string, string>; avgQuality: number;
  }[];
  odrzucone_zbiory: { datasetId: string; title: string; publisher: string; url: string; reason: string }[];
}
export const loadStats = (): Promise<Stats> => fetch('./data/stats.json').then((r) => r.json());

export function availability(a: Aed, now = new Date()): Availability {
  if (a.stan === 'niesprawny' || a.stan === 'wycofany') return 'closed';
  if (a.dostep === 'prywatny') return 'closed';
  const o = isOpenAt(a.godziny_dostepnosci, now);
  if (o === true) return 'open';
  if (o === false) return 'closed';
  return 'unknown';
}
export { is247 };

export function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000, t = Math.PI / 180;
  const dLat = (lat2 - lat1) * t, dLon = (lon2 - lon1) * t;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * t) * Math.cos(lat2 * t) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Szybki marsz/trucht ok. 1,6 m/s; odległość w linii prostej × 1,3 (współczynnik krętości ulic). */
export function walkMinutes(m: number): number { return Math.max(1, Math.round((m * 1.3) / 1.6 / 60)); }
export function fmtDist(m: number): string { return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`; }

export function shortAddress(a: Aed): string {
  return [a.nazwa_ulicy && `ul. ${a.nazwa_ulicy}${a.nr_budynku ? ' ' + a.nr_budynku : ''}`, a.miejscowosc].filter(Boolean).join(', ');
}
export function address(a: Aed): string {
  return shortAddress(a) || `adres nieustalony (${a.lat.toFixed(5)}, ${a.lon.toFixed(5)})`;
}

/** Nazwa do wyświetlenia: unika ogólników typu „Defibrylator AED” i prefiksu „AED: …”. */
export function displayName(a: Aed): string {
  const n = (a.nazwa || '').replace(/^AED:\s*/, '');
  if (n && !/^defibrylator( aed)?$/i.test(n)) return n.charAt(0).toUpperCase() + n.slice(1);
  if (a.dysponent) return a.dysponent;
  const addr = shortAddress(a);
  return addr ? `AED — ${addr}` : 'Defibrylator AED';
}

/** Linia pomocnicza pod nazwą: opis miejsca, a gdy go brak — adres. Bez powtarzania nazwy. */
export function subLine(a: Aed): string {
  const name = displayName(a).toLowerCase();
  const opisInName = !!a.opis_lokalizacji && name.includes(a.opis_lokalizacji.toLowerCase());
  const opis = a.opis_lokalizacji && !opisInName ? a.opis_lokalizacji : '';
  // gdy opis miejsca jest już nazwą — nie dopisujemy „brak opisu”
  return opis || shortAddress(a) || (opisInName ? '' : 'brak opisu miejsca — pomóż uzupełnić');
}

export const ACCESS_LABEL: Record<string, string> = {
  publiczny: 'publiczny — dla każdego', dla_klientow: 'w godzinach otwarcia obiektu', ograniczony: 'ograniczony (np. tylko personel)',
  prywatny: 'prywatny', nieznany: 'brak informacji',
};
export const SECURITY_LABEL: Record<string, string> = {
  brak: 'bez zabezpieczeń — można zabrać od razu', szafka_otwarta: 'w otwartej szafce', szafka_z_alarmem: 'szafka z alarmem — otwórz śmiało',
  szafka_na_kod: 'szafka na kod — kod poda dyspozytor 112', zamkniete_na_klucz: 'zamknięty na klucz — szukaj obsługi', u_personelu: 'u personelu obiektu',
  nieznane: 'brak informacji',
};

const SOURCES: Record<string, { name: string; url: string }> = {};
export function sourceList(a: Aed): { id: string; ref: string; name: string; url: string }[] {
  return a.zrodla.split('|').filter(Boolean).map((s) => {
    const [id, ...rest] = s.split(':'); const ref = rest.join(':');
    const url = id === 'osm' ? `https://www.openstreetmap.org/${ref}` : SOURCES[id]?.url || 'https://dane.gov.pl';
    return { id, ref, name: SOURCES[id]?.name || id, url };
  });
}
