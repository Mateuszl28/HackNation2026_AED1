// Silnik integracji: wczytanie dowolnej tabeli dysponenta (CSV/JSON/GeoJSON/XLSX→wiersze),
// automatyczne dopasowanie kolumn do wzorcowego zakresu danych, normalizacja i walidacja.
// Ten sam kod działa w pipeline (Node) i w walidatorze w przeglądarce.

import { FIELDS, FIELD_BY_NAME, REQUIRED_FIELDS, ACCESS_VALUES, SECURITY_VALUES, STATUS_VALUES } from './schema.ts';
import type { AedRecord, FieldDef } from './schema.ts';

export type Row = Record<string, unknown>;
export interface Issue { field: string; level: 'error' | 'warning' | 'info'; message: string; }
export interface MappedRow { record: AedRecord; issues: Issue[]; fixes: string[]; }

// ---------- narzędzia tekstowe ----------
export function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L');
}
export function normKey(s: string): string {
  return stripDiacritics(String(s)).toLowerCase().replace(/^﻿/, '').replace(/[^a-z0-9:]+/g, ' ').trim();
}
const clean = (v: unknown): string => (v === null || v === undefined ? '' : String(v)).replace(/\s+/g, ' ').trim();

// ---------- CSV ----------
function sniffDelimiter(line: string): string {
  const cands = [';', ',', '\t', '|'];
  let best = ',', n = -1;
  for (const c of cands) { const k = line.split(c).length; if (k > n) { n = k; best = c; } }
  return best;
}

/** Parser CSV zgodny z RFC 4180 + naprawa typowych błędów (cała linia ujęta w cudzysłów). */
export function parseCsv(text: string): { headers: string[]; rows: Row[]; fixes: string[] } {
  const fixes: string[] = [];
  let t = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const lines0 = t.split('\n').filter((l) => l.trim() !== '');
  // Naprawa: każda linia owinięta w "..." z podwojonymi cudzysłowami w środku (np. eksport z Excela „do jednej kolumny”).
  if (lines0.length > 1 && lines0.every((l) => /^".*"$/.test(l.trim())) && lines0.some((l) => l.includes('""'))) {
    t = lines0.map((l) => l.trim().slice(1, -1).replace(/""/g, '"')).join('\n');
    fixes.push('Każdy wiersz pliku był w całości ujęty w cudzysłów — rozpakowano wiersze.');
  }
  const firstLine = t.split('\n')[0];
  const d = sniffDelimiter(firstLine);
  const out: string[][] = [];
  let row: string[] = [], field = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"' && field.trim() === '') { q = true; field = ''; }
    else if (c === d) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); out.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); out.push(row); }
  const headers = (out.shift() || []).map((h) => h.trim());
  const rows = out.filter((r) => r.some((c) => c.trim() !== '')).map((r) => {
    const o: Row = {};
    headers.forEach((h, i) => { o[h] = r[i] ?? ''; });
    return o;
  });
  return { headers, rows, fixes };
}

/** Rozpoznaje JSON: tablica obiektów, GeoJSON FeatureCollection lub obiekt z tablicą w polu. */
export function parseJson(text: string): { headers: string[]; rows: Row[]; fixes: string[] } {
  const data = JSON.parse(text.replace(/^﻿/, ''));
  let rows: Row[] = [];
  const fixes: string[] = [];
  if (data && data.type === 'FeatureCollection' && Array.isArray(data.features)) {
    rows = data.features.map((f: any) => {
      const r: Row = { ...(f.properties || {}) };
      if (f.geometry && f.geometry.type === 'Point') { r.lon = f.geometry.coordinates[0]; r.lat = f.geometry.coordinates[1]; }
      return r;
    });
    fixes.push('Rozpoznano GeoJSON — współrzędne pobrano z geometrii punktów.');
  } else if (Array.isArray(data)) rows = data;
  else if (data && typeof data === 'object') {
    const arr = Object.values(data).find((v) => Array.isArray(v)) as Row[] | undefined;
    rows = arr || [];
  }
  rows = rows.map(flattenRow);
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r)))).filter((h) => !h.startsWith('__'));
  return { headers, rows, fixes };
}

export function flattenRow(r: Row): Row {
  const o: Row = {};
  // Punkt: standardowy GeoJSON [lon, lat] lub spotykany w praktyce obiekt {lat, long/lng/lon}
  const point = (g: any): boolean => {
    if (!g || g.type !== 'Point' || !g.coordinates) return false;
    const c = g.coordinates;
    if (Array.isArray(c)) { o.lon = c[0]; o.lat = c[1]; return true; }
    if (typeof c === 'object' && c.lat !== undefined) { o.lat = c.lat; o.lon = c.long ?? c.lng ?? c.lon; o.__fix_geom = 1; return true; }
    return false;
  };
  for (const [k, v] of Object.entries(r)) {
    if (k === 'geometry' && typeof v === 'string' && v.startsWith('{')) {
      try { if (point(JSON.parse(v))) continue; } catch { /* ignore */ }
    }
    if (k === 'geometry' && v && typeof v === 'object' && point(v)) continue;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v as Row)) o[`${k}.${k2}`] = v2;
    } else o[k] = v;
  }
  return o;
}

// ---------- auto-mapowanie kolumn ----------
export interface ColumnMapping { [sourceColumn: string]: string | '' }

const IDENTIFYING = new Set(['nazwa', 'id', 'opis_lokalizacji', 'szerokosc_geograficzna', 'dlugosc_geograficzna']);

export function autoMap(headers: string[], rows: Row[] = []): ColumnMapping {
  const map: ColumnMapping = {};
  const used = new Set<string>();
  // kolumny o stałej wartości (np. „Nazwa” = „Defibrylator” w każdym wierszu) nie niosą informacji identyfikującej
  const constant = new Set(rows.length > 3 ? headers.filter((h) => new Set(rows.map((r) => clean(r[h]))).size <= 1) : []);
  const allowed = (f: FieldDef, h: string) => !used.has(f.name) && !(constant.has(h) && IDENTIFYING.has(f.name));
  // 1. dopasowanie dokładne do nazwy / aliasu
  for (const h of headers) {
    const k = normKey(h);
    const f = FIELDS.find((f) => allowed(f, h) && (normKey(f.name) === k || (f.aliases || []).some((a) => normKey(a) === k)));
    if (f) { map[h] = f.name; used.add(f.name); } else map[h] = '';
  }
  // 2. dopasowanie częściowe (np. „Szerokość geograficzna WGS84”)
  for (const h of headers) {
    if (map[h]) continue;
    const k = normKey(h);
    const f = FIELDS.find((f) => allowed(f, h) && (f.aliases || []).some((a) => normKey(a).length > 5 && k.includes(normKey(a))));
    if (f) { map[h] = f.name; used.add(f.name); }
  }
  // 3. kolumny adresu w jednym polu („Adres”, „address”) → pseudo-pole
  for (const h of headers) {
    if (!map[h] && /^(adres|address|adres obiektu)$/.test(normKey(h))) map[h] = '__adres';
  }
  return map;
}

// ---------- normalizacja wartości ----------
const STREET_PREFIX: Record<string, string> = { 'ul': 'ulica', 'al': 'aleja', 'pl': 'plac', 'os': 'osiedle', 'rondo': 'rondo', 'skwer': 'skwer', 'bulw': 'bulwar' };

/** „ul. Stanisława Wyspiańskiego 20, 38-400 Krosno” → części adresu */
export function parseAddress(s: string): Partial<AedRecord> {
  const out: Partial<AedRecord> = {};
  let a = clean(s);
  const pc = a.match(/(\d{2}-\d{3})\s*([^,]*)$/);
  if (pc) { out.kod_pocztowy = pc[1]; if (pc[2].trim()) out.miejscowosc = pc[2].trim(); a = a.slice(0, pc.index).replace(/[,\s]+$/, ''); }
  const pre = a.match(/^(ul|al|pl|os|rondo|skwer|bulw)\.{0,2}\s+/i);
  if (pre) { out.cecha_ulicy = STREET_PREFIX[pre[1].toLowerCase()]; a = a.slice(pre[0].length); }
  const num = a.match(/^(.*?)[\s,]+(\d+[A-Za-z]?(?:\/\d+[A-Za-z]?)?)$/);
  if (num) {
    out.nazwa_ulicy = num[1].replace(/,$/, '').trim();
    const [b, l] = num[2].split('/');
    out.nr_budynku = b; if (l) out.nr_lokalu = l;
  } else if (a) out.nazwa_ulicy = a.replace(/,$/, '').trim();
  if (out.nazwa_ulicy && !out.cecha_ulicy) out.cecha_ulicy = 'ulica';
  return out;
}

export function normNumber(v: string): number | null {
  const s = clean(v).replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function normDate(v: string): string {
  const s = clean(v);
  if (!s) return '';
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})$/); if (m) return `${m[1]}-${m[2]}-01`;
  m = s.match(/^(\d{4})$/); if (m) return `${m[1]}-01-01`;
  return s;
}

export function normYesNo(v: string): string {
  const k = normKey(v);
  if (['tak', 'yes', 'true', '1', 't', 'y'].includes(k)) return 'TAK';
  if (['nie', 'no', 'false', '0', 'n'].includes(k)) return 'NIE';
  return clean(v);
}

export function normAccess(v: string): string {
  const k = normKey(v);
  const m: Record<string, string> = {
    yes: 'publiczny', public: 'publiczny', permissive: 'publiczny', publiczny: 'publiczny', ogolnodostepny: 'publiczny', tak: 'publiczny',
    customers: 'dla_klientow', 'dla klientow': 'dla_klientow', klienci: 'dla_klientow',
    private: 'prywatny', no: 'prywatny', prywatny: 'prywatny',
    restricted: 'ograniczony', permit: 'ograniczony', employees: 'ograniczony', staff: 'ograniczony', ograniczony: 'ograniczony', destination: 'ograniczony',
  };
  return m[k] || (ACCESS_VALUES.includes(k.replace(/ /g, '_')) ? k.replace(/ /g, '_') : clean(v));
}

export function normPhone(v: string): string {
  const d = clean(v).replace(/[^\d+]/g, '');
  if (!d) return '';
  const n = d.startsWith('+') ? d : d.startsWith('48') && d.length === 11 ? '+' + d : '+48' + d.replace(/^0+/, '');
  const m = n.match(/^\+48(\d{9})$/);
  return m ? `+48 ${m[1].slice(0, 3)} ${m[1].slice(3, 6)} ${m[1].slice(6)}` : clean(v);
}

export const inPolandLat = (x: number) => x >= 49.0 && x <= 54.9;
export const inPolandLon = (x: number) => x >= 14.1 && x <= 24.2;

/** Mapuje wiersz źródła na rekord standardu, naprawiając typowe błędy. */
export function mapRow(row: Row, mapping: ColumnMapping, defaults: Partial<AedRecord> = {}): MappedRow {
  const rec: AedRecord = {};
  const fixes: string[] = [];
  if (row.__fix_geom) fixes.push('Geometria w niestandardowym formacie {lat, long} — przekształcono do punktu WGS84.');
  for (const [col, target] of Object.entries(mapping)) {
    if (!target) continue;
    const v = clean(row[col]);
    if (!v) continue;
    if (target === '__adres') {
      const parts = parseAddress(v);
      for (const [k, val] of Object.entries(parts)) if (val && !rec[k]) rec[k] = val as string;
      continue;
    }
    rec[target] = v;
  }
  for (const [k, v] of Object.entries(defaults)) if (v && !rec[k]) rec[k] = v as string;

  // współrzędne
  let lat = normNumber(rec.szerokosc_geograficzna || '');
  let lon = normNumber(rec.dlugosc_geograficzna || '');
  if (lat !== null && lon !== null) {
    if (!inPolandLat(lat) && !inPolandLon(lon) && inPolandLat(lon) && inPolandLon(lat)) {
      [lat, lon] = [lon, lat];
      fixes.push('Zamieniono miejscami szerokość i długość geograficzną (wartości były w odwrotnych kolumnach).');
    }
    rec.szerokosc_geograficzna = lat.toFixed(6);
    rec.dlugosc_geograficzna = lon.toFixed(6);
  }
  // nazwy ulic z prefiksem
  if (rec.nazwa_ulicy) {
    const pre = rec.nazwa_ulicy.match(/^(ul|al|pl|os)\.{1,2}\s*/i);
    if (pre) { if (!rec.cecha_ulicy) rec.cecha_ulicy = STREET_PREFIX[pre[1].toLowerCase()]; rec.nazwa_ulicy = rec.nazwa_ulicy.slice(pre[0].length); fixes.push('Usunięto prefiks „ul./al.” z nazwy ulicy.'); }
  }
  if (rec.kod_pocztowy && /^\d{5}$/.test(rec.kod_pocztowy)) rec.kod_pocztowy = rec.kod_pocztowy.slice(0, 2) + '-' + rec.kod_pocztowy.slice(2);
  for (const f of FIELDS) {
    const v = rec[f.name];
    if (!v) continue;
    if (f.type === 'date') rec[f.name] = normDate(v);
    else if (f.type === 'phone') rec[f.name] = normPhone(v);
    else if (f.enumValues && f.enumValues.join() === 'TAK,NIE') rec[f.name] = normYesNo(v);
    else if (f.name === 'dostep') rec[f.name] = normAccess(v);
    else if (f.enumValues) rec[f.name] = normKey(v).replace(/ /g, '_');
  }
  return { record: rec, issues: validateRecord(rec), fixes };
}

// ---------- walidacja ----------
export function validateRecord(rec: AedRecord): Issue[] {
  const issues: Issue[] = [];
  for (const name of REQUIRED_FIELDS) {
    if (!rec[name]) issues.push({ field: name, level: name === 'szerokosc_geograficzna' || name === 'dlugosc_geograficzna' || name === 'nazwa' ? 'error' : 'warning', message: `Brak pola obowiązkowego „${FIELD_BY_NAME[name].label}”.` });
  }
  for (const [name, v] of Object.entries(rec)) {
    const f: FieldDef | undefined = FIELD_BY_NAME[name];
    if (!f || !v) continue;
    if (f.type === 'number') {
      const n = Number(v);
      if (!Number.isFinite(n)) issues.push({ field: name, level: 'error', message: `„${v}” nie jest liczbą.` });
      else if (f.min !== undefined && (n < f.min || n > (f.max as number))) issues.push({ field: name, level: 'error', message: `Wartość ${v} poza obszarem Polski.` });
      else if ((v.split('.')[1] || '').length < 5) issues.push({ field: name, level: 'warning', message: 'Za mała precyzja współrzędnych (zalecane ≥ 6 miejsc po przecinku, ~10 cm).' });
    }
    if (f.enumValues && !f.enumValues.includes(v)) issues.push({ field: name, level: 'error', message: `Wartość „${v}” spoza słownika: ${f.enumValues.join(', ')}.` });
    if (f.pattern && !new RegExp(f.pattern).test(v)) issues.push({ field: name, level: 'error', message: `Niepoprawny format „${v}” (oczekiwano: ${f.example || f.pattern}).` });
    if (f.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) issues.push({ field: name, level: 'error', message: `Data „${v}” nie jest w formacie RRRR-MM-DD.` });
    if (f.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) issues.push({ field: name, level: 'error', message: `Niepoprawny e-mail „${v}”.` });
    if (f.type === 'url' && !/^https?:\/\//.test(v)) issues.push({ field: name, level: 'error', message: `Niepoprawny URL „${v}”.` });
  }
  if (rec.data_ostatniej_kontroli && /^\d{4}-\d{2}-\d{2}$/.test(rec.data_ostatniej_kontroli)) {
    const age = (Date.now() - Date.parse(rec.data_ostatniej_kontroli)) / 864e5;
    if (age > 365) issues.push({ field: 'data_ostatniej_kontroli', level: 'warning', message: `Ostatnia kontrola ponad rok temu (${rec.data_ostatniej_kontroli}).` });
  }
  for (const d of ['data_waznosci_elektrod', 'data_waznosci_baterii']) {
    if (rec[d] && /^\d{4}-\d{2}-\d{2}$/.test(rec[d]) && Date.parse(rec[d]) < Date.now())
      issues.push({ field: d, level: 'error', message: `Termin ważności minął (${rec[d]}) — urządzenie może nie zadziałać.` });
  }
  if (rec.zabezpieczenie === 'zamkniete_na_klucz') issues.push({ field: 'zabezpieczenie', level: 'warning', message: 'AED zamknięty na klucz — rozważ szafkę z alarmem; świadek zdarzenia może nie zdążyć.' });
  return issues;
}

/** Wskaźnik jakości 0–100: pola obowiązkowe (60), zalecane (25), świeżość kontroli (15). */
export function qualityScore(rec: AedRecord): number {
  const req = FIELDS.filter((f) => f.req === 'O');
  const rec2 = FIELDS.filter((f) => f.req === 'Z');
  const a = req.filter((f) => rec[f.name]).length / req.length;
  const b = rec2.filter((f) => rec[f.name]).length / rec2.length;
  let c = 0;
  if (rec.data_ostatniej_kontroli) {
    const age = (Date.now() - Date.parse(rec.data_ostatniej_kontroli)) / 864e5;
    c = age < 400 ? 1 : age < 1100 ? 0.5 : 0.2;
  }
  return Math.round(a * 60 + b * 25 + c * 15);
}

// ---------- OpenStreetMap / OpenAEDMap → standard ----------
export function osmToRecord(p: Record<string, any>, lon: number, lat: number): AedRecord {
  const r: AedRecord = {};
  r.id = `${p['@osm_type'] || 'node'}/${p['@osm_id']}`;
  const loc = p['defibrillator:location:pl'] || p['defibrillator:location'] || p.description || p.location || '';
  const shortLoc = clean(loc).length <= 60 ? clean(loc) : '';
  r.nazwa = clean(p.name || p.operator || '') || (shortLoc ? `AED: ${shortLoc}` : 'Defibrylator AED');
  r.szerokosc_geograficzna = lat.toFixed(7);
  r.dlugosc_geograficzna = lon.toFixed(7);
  if (loc) r.opis_lokalizacji = clean(loc);
  if (p.level !== undefined && /^-?\d+$/.test(String(p.level))) r.kondygnacja = String(p.level);
  if (p.indoor) r.wewnatrz_budynku = normYesNo(p.indoor);
  if (p['addr:street']) { r.cecha_ulicy = 'ulica'; r.nazwa_ulicy = clean(p['addr:street']).replace(/^(ul|al|pl)\.\s*/i, ''); }
  if (p['addr:place'] && !r.nazwa_ulicy) r.nazwa_ulicy = '';
  if (p['addr:housenumber']) r.nr_budynku = clean(p['addr:housenumber']);
  if (p['addr:postcode']) r.kod_pocztowy = clean(p['addr:postcode']);
  if (p['addr:city'] || p['addr:place']) r.miejscowosc = clean(p['addr:city'] || p['addr:place']);
  if (p.access) r.dostep = normAccess(p.access);
  if (p.opening_hours) r.godziny_dostepnosci = clean(p.opening_hours);
  if (p.operator) r.dysponent = clean(p.operator);
  if (p.phone || p['contact:phone']) r.telefon_kontaktowy = normPhone(p.phone || p['contact:phone']);
  if (p.email || p['contact:email']) r.email_kontaktowy = clean(p.email || p['contact:email']);
  if (p.check_date) r.data_ostatniej_kontroli = normDate(p.check_date);
  if (p.manufacturer) r.producent = clean(p.manufacturer);
  if (p.model) r.model = clean(p.model);
  if (p.wheelchair) r.dostepny_dla_wozkow = normYesNo(p.wheelchair);
  if (p.image && /^https?:/.test(p.image)) r.zdjecie_url = p.image;
  if (p.note) r.uwagi = clean(p.note);
  if (p.check_date) r.data_aktualizacji = normDate(p.check_date);
  return r;
}

export { STATUS_VALUES, SECURITY_VALUES };

// ---------- kontrole na poziomie całego zbioru ----------
function distKm(a: number, b: number, c: number, d: number): number {
  const t = Math.PI / 180, h = Math.sin(((c - a) * t) / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(((d - b) * t) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

/**
 * Wykrywa błędy widoczne dopiero w kontekście całego pliku dysponenta:
 *  - punkt odległy o > 30 km od mediany pozostałych (np. współrzędne skopiowane z cudzego szablonu),
 *  - te same współrzędne dla różnych adresów (pinezka „przyklejona” z poprzedniego wiersza).
 * Dotyczy zbiorów lokalnych (gmina/powiat), dlatego uruchamiana gdy mediana rozrzutu < 30 km.
 */
export function datasetChecks(recs: AedRecord[]): Issue[][] {
  const out: Issue[][] = recs.map(() => []);
  const pts = recs.map((r) => [Number(r.szerokosc_geograficzna), Number(r.dlugosc_geograficzna)]);
  const ok = pts.map((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[0] !== 0);
  const valid = pts.filter((_, i) => ok[i]);
  if (valid.length >= 4) {
    const mLat = median(valid.map((p) => p[0])), mLon = median(valid.map((p) => p[1]));
    const d = pts.map((p) => distKm(p[0], p[1], mLat, mLon));
    const typical = median(d.filter((_, i) => ok[i]));
    if (typical < 30) {
      d.forEach((km, i) => {
        if (ok[i] && km > Math.max(30, typical * 8)) out[i].push({ field: 'szerokosc_geograficzna', level: 'error',
          message: `Punkt leży ${Math.round(km)} km od pozostałych AED w tym zbiorze — prawdopodobnie współrzędne skopiowane z innego miejsca.` });
      });
    }
  }
  const seen = new Map<string, number>();
  pts.forEach((p, i) => {
    if (!ok[i]) return;
    const k = `${p[0].toFixed(5)},${p[1].toFixed(5)}`;
    const j = seen.get(k);
    if (j !== undefined) {
      const a = recs[i], b = recs[j];
      if ((a.nazwa_ulicy || '') + (a.nr_budynku || '') !== (b.nazwa_ulicy || '') + (b.nr_budynku || ''))
        out[i].push({ field: 'szerokosc_geograficzna', level: 'warning', message: `Identyczne współrzędne jak rekord „${b.nazwa || b.id}”, ale inny adres — sprawdź położenie pinezki.` });
    } else seen.set(k, i);
  });
  return out;
}
