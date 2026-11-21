// Generuje pliki wzorcowego zakresu danych z shared/schema.ts:
//   standard/aed-wzorcowy-zakres-danych.xlsx  — opis pól + słowniki + szablon + przykład + metadane dla dane.gov.pl
//   standard/aed-szablon.csv                   — pusty szablon CSV (UTF-8)
//   standard/datapackage.json                  — Frictionless Table Schema (walidacja maszynowa)
// Uruchom: node standard/build-standard.ts

import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { FIELDS, SCHEMA_VERSION, SCHEMA_NAME, INTEGRATED_EXTRA_FIELDS } from '../shared/schema.ts';

const DIR = dirname(fileURLToPath(import.meta.url));
const WEB = join(DIR, '..', 'web', 'public', 'standard');
mkdirSync(WEB, { recursive: true });

const GREEN = 'FF007A3D', NAVY = 'FF0B2A3C', MINT = 'FFE6F4EC';
const REQ = { O: 'Obowiązkowe', Z: 'Zalecane', F: 'Fakultatywne' } as const;

const EXAMPLES: Record<string, string>[] = [
  { id: 'UMBDG-AED-0001', nazwa: 'Ratusz — Urząd Miasta Bydgoszczy', szerokosc_geograficzna: '53.122710', dlugosc_geograficzna: '17.998640',
    opis_lokalizacji: 'Parter, hol główny przy biurze podawczym', kondygnacja: '0', wewnatrz_budynku: 'TAK', cecha_ulicy: 'ulica', nazwa_ulicy: 'Jezuicka',
    nr_budynku: '1', kod_pocztowy: '85-102', miejscowosc: 'Bydgoszcz', kod_terc: '0461011', kod_simc: '0928943', wojewodztwo: 'kujawsko-pomorskie',
    dostep: 'dla_klientow', godziny_dostepnosci: 'Mo-Fr 07:30-15:30', zabezpieczenie: 'szafka_z_alarmem', instrukcja_dostepu: 'Szafka bez klucza, otwarcie uruchamia alarm',
    elektrody_dzieciece: 'TAK', dostepny_dla_wozkow: 'TAK', stan: 'sprawny', data_ostatniej_kontroli: '2026-10-15', data_waznosci_elektrod: '2028-03-31',
    data_waznosci_baterii: '2029-06-30', producent: 'Philips', model: 'HeartStart FRx', dysponent: 'Urząd Miasta Bydgoszczy', dysponent_regon: '000515590',
    telefon_kontaktowy: '+48 52 585 88 00', email_kontaktowy: 'aed@example.bydgoszcz.pl', zdjecie_url: '', data_aktualizacji: '2026-11-21', uwagi: 'Dane przykładowe' },
  { id: 'UMBDG-AED-0002', nazwa: 'Wyspa Młyńska — kapsuła AED', szerokosc_geograficzna: '53.123480', dlugosc_geograficzna: '17.994930',
    opis_lokalizacji: 'Na zewnątrz, ściana budynku Młynów Rothera od strony Brdy', kondygnacja: '0', wewnatrz_budynku: 'NIE', cecha_ulicy: 'ulica', nazwa_ulicy: 'Mennica',
    nr_budynku: '10', kod_pocztowy: '85-112', miejscowosc: 'Bydgoszcz', kod_terc: '0461011', kod_simc: '0928943', wojewodztwo: 'kujawsko-pomorskie',
    dostep: 'publiczny', godziny_dostepnosci: '24/7', zabezpieczenie: 'szafka_z_alarmem', instrukcja_dostepu: '', elektrody_dzieciece: 'TAK', dostepny_dla_wozkow: 'TAK',
    stan: 'sprawny', data_ostatniej_kontroli: '2026-09-30', data_waznosci_elektrod: '2027-12-31', data_waznosci_baterii: '2030-01-31', producent: '', model: '',
    dysponent: 'Urząd Miasta Bydgoszczy', dysponent_regon: '000515590', telefon_kontaktowy: '', email_kontaktowy: '', zdjecie_url: '', data_aktualizacji: '2026-11-21', uwagi: 'Dane przykładowe' },
];

function header(ws: ExcelJS.Worksheet) {
  const r = ws.getRow(1);
  r.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
  r.alignment = { vertical: 'middle', wrapText: true };
  r.height = 30;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AEDostępni'; wb.title = SCHEMA_NAME; wb.created = new Date();

  // 1. Info
  const info = wb.addWorksheet('Informacje', { properties: { tabColor: { argb: GREEN } } });
  info.columns = [{ width: 32 }, { width: 110 }];
  const rows: [string, string][] = [
    ['Nazwa', SCHEMA_NAME], ['Wersja', SCHEMA_VERSION], ['Data', new Date().toISOString().slice(0, 10)],
    ['Cel', 'Jednolity sposób udostępniania danych o defibrylatorach AED w portalu dane.gov.pl przez wszystkich dysponentów (gminy, szpitale, uczelnie, firmy, przewoźników, organizacje).'],
    ['Zasady ogólne', 'Jeden wiersz = jeden AED. Kodowanie UTF-8. Separator CSV: przecinek. Separator dziesiętny: kropka. Daty ISO 8601 (RRRR-MM-DD). Współrzędne WGS84 (EPSG:4326) w stopniach dziesiętnych z min. 6 miejscami po przecinku. Nazwy kolumn dokładnie jak w arkuszu „Zakres danych”.'],
    ['Wymagalność', 'O — obowiązkowe (bez nich rekord nie jest przydatny dla ratujących), Z — zalecane, F — fakultatywne.'],
    ['Adres', 'Zgodnie z rejestrem TERYT (TERC, SIMC, ULIC) oraz rozporządzeniem w sprawie ewidencji miejscowości, ulic i adresów.'],
    ['Godziny', 'Składnia opening_hours (OpenStreetMap), np. „24/7”, „Mo-Fr 08:00-16:00; Sa 09:00-13:00”. Zapewnia interoperacyjność z OSM i aplikacjami mobilnymi.'],
    ['Bezpieczeństwo', 'Nie publikuj kodów do szafek ani danych osobowych osób fizycznych. Podawaj kontakty służbowe instytucji.'],
    ['Formaty publikacji', 'CSV (zalecany), XLSX, JSON, GeoJSON. Niedopuszczalne: PDF, DOC, skany. Zalecane udostępnienie przez API lub stały link do pliku — umożliwia automatyczną aktualizację.'],
    ['Metadane zbioru na dane.gov.pl', 'Tytuł: „Lokalizacje defibrylatorów AED — [instytucja]”. Słowa kluczowe: AED, defibrylator, AEDostępni. Kategoria: Zdrowie. Licencja: CC0 1.0 (zalecana) lub CC BY 4.0. Częstotliwość aktualizacji: co miesiąc.'],
    ['Zbiór krajowy', `Zbiór zintegrowany zawiera dodatkowo pola: ${INTEGRATED_EXTRA_FIELDS.map((f) => f.name).join(', ')} (pochodzenie danych i jakość).`],
  ];
  info.addRows(rows);
  info.getColumn(1).font = { bold: true, color: { argb: NAVY } };
  info.getColumn(2).alignment = { wrapText: true, vertical: 'top' };
  info.insertRow(1, ['AEDostępni — Udostępnij dane. Daj komuś czas.']);
  info.getRow(1).font = { bold: true, size: 16, color: { argb: GREEN } };

  // 2. Zakres danych
  const z = wb.addWorksheet('Zakres danych');
  z.columns = [
    { header: 'Lp.', key: 'lp', width: 5 }, { header: 'Grupa', key: 'group', width: 16 }, { header: 'Nazwa kolumny', key: 'name', width: 26 },
    { header: 'Etykieta', key: 'label', width: 30 }, { header: 'Opis', key: 'description', width: 60 }, { header: 'Typ', key: 'type', width: 10 },
    { header: 'Wymagalność', key: 'req', width: 13 }, { header: 'Format / słownik', key: 'format', width: 40 }, { header: 'Przykład', key: 'example', width: 28 },
    { header: 'Odpowiednik OSM', key: 'osm', width: 22 },
  ];
  FIELDS.forEach((f, i) => {
    const row = z.addRow({ lp: i + 1, group: f.group, name: f.name, label: f.label, description: f.description, type: f.type, req: `${f.req} — ${REQ[f.req]}`,
      format: f.enumValues ? f.enumValues.join(' | ') : f.format || f.pattern || '', example: f.example, osm: f.osm || '' });
    if (f.req === 'O') row.getCell('req').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MINT } };
  });
  header(z);
  z.eachRow((r, n) => { if (n > 1) r.alignment = { wrapText: true, vertical: 'top' }; });
  z.autoFilter = 'A1:J1';

  // 3. Słowniki
  const s = wb.addWorksheet('Słowniki');
  s.columns = [{ header: 'Pole', key: 'f', width: 26 }, { header: 'Wartość', key: 'v', width: 24 }];
  for (const f of FIELDS) if (f.enumValues) for (const v of f.enumValues) s.addRow({ f: f.name, v });
  header(s);

  // 4. Szablon do wypełnienia (z listami rozwijanymi)
  const t = wb.addWorksheet('Szablon', { properties: { tabColor: { argb: 'FFD7262E' } } });
  t.columns = FIELDS.map((f) => ({ header: f.name, key: f.name, width: Math.max(14, f.name.length + 2) }));
  header(t);
  FIELDS.forEach((f, i) => {
    const col = t.getColumn(i + 1);
    if (f.req === 'O') t.getCell(1, i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD7262E' } };
    t.getCell(1, i + 1).note = `${f.label} (${REQ[f.req]})\n${f.description}\nPrzykład: ${f.example}`;
    if (f.enumValues) for (let r = 2; r <= 500; r++) t.getCell(r, i + 1).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${f.enumValues.join(',')}"`] };
    if (f.type === 'number') for (let r = 2; r <= 500; r++) t.getCell(r, i + 1).dataValidation = { type: 'decimal', operator: 'between', allowBlank: true, formulae: [f.min!, f.max!], showErrorMessage: true, errorTitle: 'Współrzędna', error: 'Wartość poza obszarem Polski (WGS84).' };
    void col;
  });

  // 5. Przykład
  const p = wb.addWorksheet('Przykład');
  p.columns = FIELDS.map((f) => ({ header: f.name, key: f.name, width: Math.max(14, f.name.length + 2) }));
  p.addRows(EXAMPLES);
  header(p);

  // 6. Mapowanie przykładowych źródeł
  const m = wb.addWorksheet('Mapowanie źródeł');
  m.columns = [{ header: 'Źródło', key: 's', width: 36 }, { header: 'Kolumna w źródle', key: 'c', width: 30 }, { header: 'Pole standardu', key: 'f', width: 28 }, { header: 'Uwagi', key: 'u', width: 60 }];
  const maps = [
    ['UM Krosno (dane.gov.pl, CSV)', 'Długość geograficzna', 'dlugosc_geograficzna', ''], ['UM Krosno', 'Lokalizacja', 'nazwa', 'Kolumna „Nazwa” zawiera zawsze „Defibrylator” — pomijana'],
    ['UM Krosno', 'Adres', '(rozbicie) nazwa_ulicy, nr_budynku, kod_pocztowy, miejscowosc', 'Adres w jednym polu rozbijany automatycznie'],
    ['UM Marki (dane.gov.pl, CSV)', 'Długość / Szerokość geograficzna', 'szerokosc / dlugosc', 'Kolumny zamienione miejscami + każdy wiersz w cudzysłowie — naprawiane automatycznie'],
    ['UM Przemyśl (dane.gov.pl, CSV/JSON)', 'geometry (GeoJSON w komórce)', 'szerokosc/dlugosc_geograficzna', ''], ['UM Przemyśl', 'street, home_number, postcode, city', 'nazwa_ulicy, nr_budynku, kod_pocztowy, miejscowosc', ''],
    ['UM Legionowo (dane.gov.pl, CSV)', 'cecha_ulicy … kod_simc', 'identyczne nazwy', 'Najbliżej standardu — zawiera kody TERYT'],
    ['OpenStreetMap / OpenAEDMap', 'defibrillator:location, opening_hours, access, indoor, level, operator, check_date', 'opis_lokalizacji, godziny_dostepnosci, dostep, wewnatrz_budynku, kondygnacja, dysponent, data_ostatniej_kontroli', 'Pełna lista w kolumnie „Odpowiednik OSM”'],
  ];
  m.addRows(maps);
  header(m);
  m.eachRow((r, n) => { if (n > 1) r.alignment = { wrapText: true, vertical: 'top' }; });

  const xlsxPath = join(DIR, 'aed-wzorcowy-zakres-danych.xlsx');
  await wb.xlsx.writeFile(xlsxPath);

  // CSV szablon
  const csv = '﻿' + FIELDS.map((f) => f.name).join(',') + '\r\n';
  writeFileSync(join(DIR, 'aed-szablon.csv'), csv);
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  writeFileSync(join(DIR, 'aed-przyklad.csv'), csv + EXAMPLES.map((e) => FIELDS.map((f) => esc(e[f.name] || '')).join(',')).join('\r\n') + '\r\n');

  // Frictionless Data Package / Table Schema
  const typeMap: Record<string, string> = { string: 'string', number: 'number', integer: 'integer', boolean: 'boolean', date: 'date', datetime: 'datetime', enum: 'string', url: 'string', email: 'string', phone: 'string' };
  const dp = {
    name: 'aed-polska', title: SCHEMA_NAME, version: SCHEMA_VERSION, licenses: [{ name: 'CC0-1.0', path: 'https://creativecommons.org/publicdomain/zero/1.0/' }],
    keywords: ['AED', 'defibrylator', 'AEDostępni', 'dane.gov.pl'],
    resources: [{
      name: 'aed', path: 'aed.csv', format: 'csv', mediatype: 'text/csv', encoding: 'utf-8',
      schema: {
        primaryKey: ['id'],
        fields: FIELDS.map((f) => ({
          name: f.name, title: f.label, description: f.description, type: typeMap[f.type],
          ...(f.type === 'date' ? { format: '%Y-%m-%d' } : {}), ...(f.type === 'email' ? { format: 'email' } : {}), ...(f.type === 'url' ? { format: 'uri' } : {}),
          constraints: { ...(f.req === 'O' ? { required: true } : {}), ...(f.enumValues ? { enum: f.enumValues } : {}), ...(f.pattern ? { pattern: f.pattern } : {}),
            ...(f.min !== undefined ? { minimum: f.min, maximum: f.max } : {}) },
          ...(f.osm ? { 'x-osm-tag': f.osm } : {}),
        })),
      },
    }],
  };
  writeFileSync(join(DIR, 'datapackage.json'), JSON.stringify(dp, null, 2));

  for (const f of ['aed-wzorcowy-zakres-danych.xlsx', 'aed-szablon.csv', 'aed-przyklad.csv', 'datapackage.json']) copyFileSync(join(DIR, f), join(WEB, f));
  console.log(`✓ Standard ${SCHEMA_VERSION}: ${FIELDS.length} pól → XLSX, CSV, datapackage.json`);
}
main().catch((e) => { console.error(e); process.exit(1); });
