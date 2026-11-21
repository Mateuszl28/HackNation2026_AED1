// Testy jednostkowe silnika danych AEDostępni (node:test, bez zależności).
// Uruchom: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOpenAt, normalizeHours, is247 } from '../shared/hours.ts';
import { parseCsv, parseJson, autoMap, mapRow, parseAddress, validateRecord, datasetChecks, qualityScore, osmToRecord, flattenRow } from '../shared/mapper.ts';
import { FIELDS, REQUIRED_FIELDS } from '../shared/schema.ts';
import { dcatXml, MEDIA } from '../shared/dcat.ts';

const at = (s: string) => new Date(s);

test('godziny: 24/7 i zapisy polskie', () => {
  assert.equal(isOpenAt('24/7', at('2026-11-23T03:00')), true);
  assert.equal(isOpenAt('Całodobowo', at('2026-11-23T03:00')), true);
  assert.equal(is247('24/7'), true);
});

test('godziny: dni robocze, weekend, święta', () => {
  assert.equal(isOpenAt('Mo-Fr 08:00-16:00', at('2026-11-23T10:00')), true);   // poniedziałek
  assert.equal(isOpenAt('Mo-Fr 08:00-16:00', at('2026-11-23T17:00')), false);
  assert.equal(isOpenAt('Mo-Fr 08:00-16:00', at('2026-11-22T10:00')), false);  // niedziela
  assert.equal(isOpenAt('Mo 06:00-18:00; Tu-Fr 06:00-15:00; Sa-Su, PH off', at('2026-11-21T12:00')), false);
});

test('godziny: przecinki zamiast średników, godziny bez minut, sezony', () => {
  assert.equal(isOpenAt('Mo 10:00-16:00, Tu 08:00-16:00', at('2026-11-24T09:00')), true);
  assert.equal(isOpenAt('7-21:30', at('2026-11-23T08:00')), true);
  assert.equal(isOpenAt('Jun-Aug Mo-Su 09:30-18:30', at('2026-11-23T10:00')), false);
  assert.equal(isOpenAt('Jun-Aug Mo-Su 09:30-18:30', at('2026-07-13T10:00')), true);
  assert.equal(isOpenAt('Nov-Mar: 00:00-24:00; Apr-Oct: Mo-Fr 06:30-16:30', at('2026-11-22T23:00')), true);
  assert.equal(normalizeHours('Mo- Fr 7:00-20:00 Sa 07:00-15:00'), 'Mo-Fr 07:00-20:00; Sa 07:00-15:00');
});

test('godziny: opis słowny jest nieinterpretowalny (null)', () => {
  assert.equal(isOpenAt('Dostępne w godzinach pracy kolei linowej', at('2026-11-23T10:00')), null);
});

test('CSV: separator, cudzysłowy RFC 4180 i naprawa „cały wiersz w cudzysłowie”', () => {
  const a = parseCsv('id;nazwa\n1;"Urząd; parter"\n');
  assert.deepEqual(a.headers, ['id', 'nazwa']);
  assert.equal(a.rows[0].nazwa, 'Urząd; parter');
  const b = parseCsv('"a,b"\n"1,""X"""\n"2,""Y"""\n');
  assert.equal(b.rows.length, 2);
  assert.equal(b.rows[0].b, 'X');
  assert.ok(b.fixes.length > 0);
});

test('JSON/GeoJSON: punkty z geometrii, także niestandardowy obiekt {lat, long}', () => {
  const gj = parseJson(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [18.0, 53.12] }, properties: { name: 'A' } }] }));
  assert.equal(gj.rows[0].lat, 53.12);
  const odd = flattenRow({ geometry: '{"type":"Point","coordinates":{"lat":"49.78","long":"22.77"}}' });
  assert.equal(odd.lat, '49.78');
  assert.equal(odd.lon, '22.77');
});

test('auto-mapowanie: aliasy, kolumna stała pomijana, adres w jednym polu', () => {
  const rows = [1, 2, 3, 4].map((i) => ({ 'Długość geograficzna': '21.7', 'Szerokość geograficzna': '49.7', Nazwa: 'Defibrylator', Lokalizacja: `Obiekt ${i}`, Adres: 'ul. Jasna 5, 38-400 Krosno', 'Numer Id': String(i) }));
  const m = autoMap(Object.keys(rows[0]), rows);
  assert.equal(m['Długość geograficzna'], 'dlugosc_geograficzna');
  assert.equal(m.Nazwa, '');            // stała wartość „Defibrylator” nie identyfikuje AED
  assert.equal(m.Lokalizacja, 'nazwa');
  assert.equal(m.Adres, '__adres');
});

test('adres: rozbicie „ul. Stanisława Wyspiańskiego 20, 38-400 Krosno”', () => {
  assert.deepEqual(parseAddress('ul. Stanisława Wyspiańskiego 20, 38-400 Krosno'), {
    kod_pocztowy: '38-400', miejscowosc: 'Krosno', cecha_ulicy: 'ulica', nazwa_ulicy: 'Stanisława Wyspiańskiego', nr_budynku: '20',
  });
});

test('mapowanie wiersza: zamienione współrzędne są naprawiane', () => {
  const r = mapRow({ x: '52.326697', y: '21.107557', n: 'Urząd' }, { x: 'dlugosc_geograficzna', y: 'szerokosc_geograficzna', n: 'nazwa' });
  assert.equal(r.record.szerokosc_geograficzna, '52.326697');
  assert.equal(r.record.dlugosc_geograficzna, '21.107557');
  assert.ok(r.fixes.some((f) => f.includes('Zamieniono')));
});

test('walidacja: braki pól obowiązkowych, zły kod pocztowy, przeterminowane elektrody, opisowe godziny', () => {
  const issues = validateRecord({ nazwa: 'X', szerokosc_geograficzna: '53.123456', dlugosc_geograficzna: '18.123456', kod_pocztowy: '85102', data_waznosci_elektrod: '2020-01-01', godziny_dostepnosci: 'w godzinach pracy' });
  const msgs = issues.map((i) => i.message).join('\n');
  assert.match(msgs, /Brak pola obowiązkowego/);
  assert.match(msgs, /Niepoprawny format/);
  assert.match(msgs, /Termin ważności minął/);
  assert.match(msgs, /zapisano opisowo/);
});

test('kontrole zbioru: punkt skopiowany z innego miasta i zdublowane współrzędne', () => {
  const base = { nazwa: 'A' } as Record<string, string>;
  const recs = [
    { ...base, szerokosc_geograficzna: '52.3267', dlugosc_geograficzna: '21.1075', nazwa_ulicy: 'A', nr_budynku: '1' },
    { ...base, szerokosc_geograficzna: '52.3239', dlugosc_geograficzna: '21.0981', nazwa_ulicy: 'B', nr_budynku: '2' },
    { ...base, szerokosc_geograficzna: '52.3170', dlugosc_geograficzna: '21.1041', nazwa_ulicy: 'C', nr_budynku: '3' },
    { ...base, szerokosc_geograficzna: '52.3170', dlugosc_geograficzna: '21.1041', nazwa_ulicy: 'D', nr_budynku: '4' },
    { ...base, szerokosc_geograficzna: '49.7188', dlugosc_geograficzna: '21.7203', nazwa_ulicy: 'E', nr_budynku: '5' }, // Krosno w pliku z Marek
  ];
  const out = datasetChecks(recs);
  assert.ok(out[4].some((i) => i.level === 'error' && /km od pozostałych/.test(i.message)));
  assert.ok(out[3].some((i) => /Identyczne współrzędne/.test(i.message)));
});

test('OSM → standard: tagi emergency=defibrillator', () => {
  const r = osmToRecord({ '@osm_type': 'node', '@osm_id': 1, access: 'yes', opening_hours: '24/7', 'defibrillator:location': 'przy wejściu', indoor: 'yes' }, 18, 53);
  assert.equal(r.dostep, 'publiczny');
  assert.equal(r.wewnatrz_budynku, 'TAK');
  assert.equal(r.nazwa, 'AED: przy wejściu');
  assert.ok(qualityScore(r) > 0);
});

test('standard: 35 pól, unikalne nazwy, pola obowiązkowe istnieją', () => {
  assert.equal(FIELDS.length, 35);
  assert.equal(new Set(FIELDS.map((f) => f.name)).size, FIELDS.length);
  for (const n of ['nazwa', 'szerokosc_geograficzna', 'dlugosc_geograficzna', 'godziny_dostepnosci']) assert.ok(REQUIRED_FIELDS.includes(n));
});

test('DCAT-AP: poprawny XML z dystrybucjami i escapowaniem', () => {
  const xml = dcatXml({ id: 'test', title: 'AED <&> test', description: 'd', publisher: 'P', keywords: ['AED'], modified: '2026-11-21', accrualPeriodicity: 'DAILY', license: 'https://example.org/l', distributions: [{ title: 'CSV', url: 'https://example.org/a.csv', format: 'CSV', mediaType: MEDIA.CSV }] });
  assert.match(xml, /<dcat:Dataset /);
  assert.match(xml, /AED &lt;&amp;&gt; test/);
  assert.match(xml, /<dcat:mediaType>text\/csv<\/dcat:mediaType>/);
  assert.doesNotMatch(xml, /aedostepni\.pl/);
});

import { serviceEvents, toIcs } from '../shared/ics.ts';
test('kalendarz serwisowy: elektrody, bateria, kontrola + poprawny iCalendar', () => {
  const ev = serviceEvents([{ id: 'A1', nazwa: 'Ratusz', data_waznosci_elektrod: '2027-03-31', data_waznosci_baterii: '2029-06-30', data_ostatniej_kontroli: '2026-10-15' }], '2026-11-21');
  assert.deepEqual(ev.map((e) => e.date), ['2027-02-28', '2027-10-15', '2029-05-30']);
  const ics = toIcs(ev);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 3);
  assert.match(ics, /DTSTART;VALUE=DATE:20270228/);
  assert.ok(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75));
});

test('formularz: dni i godziny → opening_hours, rozumiane przez interpreter', async () => {
  const { rulesToOpeningHours, isOpenAt } = await import('../shared/hours.ts');
  const wd = [true, true, true, true, true, false, false], sat = [false, false, false, false, false, true, false];
  const oh = rulesToOpeningHours([{ days: wd, from: '08:00', to: '16:00' }, { days: sat, from: '09:00', to: '13:00' }], false);
  assert.equal(oh, 'Mo-Fr 08:00-16:00; Sa 09:00-13:00');
  assert.equal(rulesToOpeningHours([{ days: [true, false, true, false, true, false, false], from: '10:00', to: '12:00' }], false), 'Mo,We,Fr 10:00-12:00');
  assert.equal(rulesToOpeningHours([{ days: [false, false, false, false, false, true, true], from: '10:00', to: '12:00' }], false), 'Sa,Su 10:00-12:00');
  assert.equal(rulesToOpeningHours([], true), '24/7');
  assert.equal(isOpenAt(oh, new Date(2026, 10, 21, 10, 0)), true);   // sobota 10:00
  assert.equal(isOpenAt(oh, new Date(2026, 10, 22, 10, 0)), false);  // niedziela
  assert.equal(isOpenAt('Mo,We,Fr 10:00-12:00', new Date(2026, 10, 25, 11, 0)), true); // środa
});
