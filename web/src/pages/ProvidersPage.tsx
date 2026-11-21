import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { FIELDS, FIELD_BY_NAME, SCHEMA_VERSION } from '@shared/schema.ts';
import { dcatXml, MEDIA } from '@shared/dcat.ts';
import { stripDiacritics } from '@shared/mapper.ts';
import { parseCsv, parseJson, autoMap, mapRow, qualityScore, flattenRow, datasetChecks } from '@shared/mapper.ts';
import type { ColumnMapping, Row, MappedRow } from '@shared/mapper.ts';

type Parsed = { name: string; headers: string[]; rows: Row[]; fixes: string[] };

const SAMPLES = [
  { file: 'marki.csv', label: 'UM Marki (CSV z błędami)' },
  { file: 'krosno.csv', label: 'UM Krosno (CSV)' },
  { file: 'przemysl.json', label: 'UM Przemyśl (JSON)' },
  { file: 'legionowo.csv', label: 'UM Legionowo (CSV z TERYT)' },
];

async function readFile(f: File): Promise<Parsed> {
  const name = f.name;
  if (/\.(xlsx|xls|ods)$/i.test(name)) {
    const wb = XLSX.read(await f.arrayBuffer());
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Row>(ws, { defval: '', raw: false });
    return { name, headers: Object.keys(rows[0] || {}), rows, fixes: [] };
  }
  const text = await f.text();
  return parseText(name, text);
}
function parseText(name: string, text: string): Parsed {
  const isJson = /\.(json|geojson)$/i.test(name) || /^\s*[[{]/.test(text);
  const p = isJson ? parseJson(text) : parseCsv(text);
  const rows = p.rows.map(flattenRow);
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r)))).filter((h) => !h.startsWith('__'));
  return { name, headers, rows, fixes: p.fixes };
}

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ProvidersPage() {
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [defaults, setDefaults] = useState({ dysponent: '', miejscowosc: '' });
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState(false);

  function load(p: Parsed) {
    setParsed(p); setMapping(autoMap(p.headers, p.rows)); setErr('');
  }
  async function onFile(f?: File | null) {
    if (!f) return;
    try { load(await readFile(f)); } catch (e) { setErr(`Nie udało się odczytać pliku: ${(e as Error).message}`); }
  }
  async function sample(file: string) {
    const t = await fetch(`./samples/${file}`).then((r) => r.text());
    load(parseText(file, t));
  }

  const result: MappedRow[] = useMemo(() => {
    if (!parsed) return [];
    const rows = parsed.rows.map((r) => mapRow(r, mapping, defaults));
    datasetChecks(rows.map((r) => r.record)).forEach((iss, i) => rows[i].issues.push(...iss));
    return rows;
  }, [parsed, mapping, defaults]);
  const summary = useMemo(() => {
    const errors = result.filter((r) => r.issues.some((i) => i.level === 'error')).length;
    const warns = result.reduce((s, r) => s + r.issues.filter((i) => i.level === 'warning').length, 0);
    const fixes: Record<string, number> = {};
    for (const f of parsed?.fixes || []) fixes[f] = 1;
    for (const r of result) for (const f of r.fixes) fixes[f] = (fixes[f] || 0) + 1;
    const q = result.length ? Math.round(result.reduce((s, r) => s + qualityScore(r.record), 0) / result.length) : 0;
    const mapped = new Set(Object.values(mapping).filter(Boolean));
    const missingRequired = FIELDS.filter((f) => f.req === 'O' && !mapped.has(f.name) && !(defaults as Record<string, string>)[f.name]
      && !(mapped.has('__adres') && ['nazwa_ulicy', 'nr_budynku', 'kod_pocztowy', 'miejscowosc'].includes(f.name)));
    const perIssue: Record<string, number> = {};
    for (const r of result) for (const i of r.issues) { const k = i.message.startsWith('Brak pola') ? i.message : `${FIELD_BY_NAME[i.field]?.label || i.field}: ${i.message.replace(/„[^”]*”/g, '…')}`; perIssue[k] = (perIssue[k] || 0) + 1; }
    return { errors, warns, fixes, q, missingRequired, perIssue: Object.entries(perIssue).sort((a, b) => b[1] - a[1]) };
  }, [result, parsed, mapping, defaults]);

  const cols = FIELDS.map((f) => f.name);
  function exportCsv() {
    const esc = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const body = [cols.join(','), ...result.map((r) => cols.map((c) => esc(r.record[c] || '')).join(','))].join('\r\n');
    download('aed-standard.csv', '﻿' + body, 'text/csv;charset=utf-8');
  }
  function exportJson() {
    download('aed-standard.json', JSON.stringify({ wersja_standardu: SCHEMA_VERSION, dane: result.map((r) => r.record) }, null, 2), 'application/json');
  }
  function exportXlsx() {
    const ws = XLSX.utils.json_to_sheet(result.map((r) => Object.fromEntries(cols.map((c) => [c, r.record[c] || '']))), { header: cols });
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'aed');
    download('aed-standard.xlsx', XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }
  const meta = {
    tytul: `Lokalizacje defibrylatorów AED — ${defaults.dysponent || '[nazwa instytucji]'}`,
    opis: `Wykaz defibrylatorów AED udostępnianych przez ${defaults.dysponent || '[instytucję]'} zgodnie z wzorcowym zakresem danych AEDostępni v${SCHEMA_VERSION}. Dane obejmują lokalizację (WGS84), dokładne miejsce zawieszenia, godziny i zasady dostępu oraz stan techniczny urządzeń.`,
    slowa_kluczowe: ['AED', 'defibrylator', 'AEDostępni', 'ratownictwo', 'zdrowie', defaults.miejscowosc].filter(Boolean),
    kategoria: 'Zdrowie',
    licencja: 'CC0 1.0 (bez ograniczeń)',
    czestotliwosc_aktualizacji: 'co miesiąc (oraz po każdej zmianie lokalizacji/stanu AED)',
    format: 'CSV (UTF-8) + XLSX + JSON',
  };
  function exportDcat() {
    const who = defaults.dysponent || 'Instytucja';
    const slug = stripDiacritics(who).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const base = 'https://twoja-instytucja.example/dane/aed'; // adres, pod którym dysponent udostępni pliki
    const xml = dcatXml({
      id: `aed-${slug}`, title: meta.tytul, description: meta.opis, publisher: who, keywords: meta.slowa_kluczowe as string[],
      modified: new Date().toISOString().slice(0, 10), accrualPeriodicity: 'MONTHLY', license: 'https://creativecommons.org/publicdomain/zero/1.0/',
      spatial: defaults.miejscowosc || undefined,
      distributions: [
        { title: 'Lokalizacje AED — CSV', url: `${base}/aed-standard.csv`, format: 'CSV', mediaType: MEDIA.CSV },
        { title: 'Lokalizacje AED — XLSX', url: `${base}/aed-standard.xlsx`, format: 'XLSX', mediaType: MEDIA.XLSX },
      ],
    });
    download('metadane-dcat-ap.xml', xml, 'application/rdf+xml');
  }

  const ok = parsed && summary.errors === 0 && summary.missingRequired.length === 0;

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Dla gmin, szpitali, firm, uczelni i innych dysponentów AED</p>
        <h1>Opublikuj dane o swoich AED w 5 minut</h1>
        <p className="lead">Wgraj plik w dowolnej postaci (CSV, XLSX, JSON, GeoJSON). Automatycznie dopasujemy kolumny do wzorcowego zakresu danych, naprawimy typowe błędy i przygotujemy pliki gotowe do publikacji w portalu <a href="https://dane.gov.pl" target="_blank" rel="noopener">dane.gov.pl</a>. Wszystko dzieje się w Twojej przeglądarce — plik nigdzie nie jest wysyłany.</p>
      </header>

      <ol className="steps" aria-label="Kroki">
        <li className={parsed ? 'done' : 'current'}><span>1</span>Wgraj plik</li>
        <li className={parsed ? (ok ? 'done' : 'current') : ''}><span>2</span>Sprawdź mapowanie i błędy</li>
        <li className={ok ? 'current' : ''}><span>3</span>Pobierz i opublikuj</li>
      </ol>

      <section className="card" aria-labelledby="s1">
        <h2 id="s1">1. Wgraj plik z danymi</h2>
        <div className="grid-2">
          <div>
            <label
              className={`dropzone ${drag ? 'drag' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]); }}
            >
              <input type="file" accept=".csv,.txt,.json,.geojson,.xlsx,.xls,.ods" onChange={(e) => onFile(e.target.files?.[0])} />
              <strong>Wybierz plik</strong> albo upuść go tutaj
              <small>CSV, XLSX, ODS, JSON, GeoJSON</small>
            </label>
            {err && <p className="error" role="alert">{err}</p>}
          </div>
          <div>
            <p><strong>Nie masz pliku?</strong> Pobierz szablon i wypełnij go:</p>
            <p className="btn-row">
              <a className="btn" href="./standard/aed-wzorcowy-zakres-danych.xlsx" download>Szablon + opis pól (XLSX)</a>
              <a className="btn" href="./standard/aed-szablon.csv" download>Pusty szablon (CSV)</a>
            </p>
            <p><strong>Wypróbuj na prawdziwych danych z dane.gov.pl:</strong></p>
            <p className="btn-row">{SAMPLES.map((s) => <button key={s.file} className="btn btn-ghost btn-sm" onClick={() => sample(s.file)}>{s.label}</button>)}</p>
          </div>
        </div>
      </section>

      {parsed && (
        <>
          <section className="card" aria-labelledby="s2">
            <h2 id="s2">2. Dopasowanie kolumn <small className="muted">— {parsed.name}, {parsed.rows.length} wierszy</small></h2>
            <div className="grid-2">
              <label className="field">Dysponent (jeśli brak w pliku)
                <input value={defaults.dysponent} onChange={(e) => setDefaults({ ...defaults, dysponent: e.target.value })} placeholder="np. Urząd Miasta Bydgoszczy" />
              </label>
              <label className="field">Miejscowość (jeśli brak w pliku)
                <input value={defaults.miejscowosc} onChange={(e) => setDefaults({ ...defaults, miejscowosc: e.target.value })} placeholder="np. Bydgoszcz" />
              </label>
            </div>
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">Mapowanie kolumn pliku na pola standardu</caption>
                <thead><tr><th scope="col">Kolumna w Twoim pliku</th><th scope="col">Przykładowa wartość</th><th scope="col">Pole standardu</th></tr></thead>
                <tbody>
                  {parsed.headers.map((h) => (
                    <tr key={h}>
                      <th scope="row"><code>{h}</code></th>
                      <td className="trunc">{String(parsed.rows[0]?.[h] ?? '').slice(0, 60)}</td>
                      <td>
                        <select aria-label={`Pole standardu dla kolumny ${h}`} value={mapping[h] || ''} onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })}>
                          <option value="">— pomiń —</option>
                          <option value="__adres">Adres w jednym polu (rozbij automatycznie)</option>
                          {FIELDS.map((f) => <option key={f.name} value={f.name}>{f.label} ({f.req})</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card" aria-labelledby="s2b">
            <h2 id="s2b">Wynik walidacji</h2>
            <div className="kpis">
              <div className="kpi"><b>{result.length}</b><span>rekordów</span></div>
              <div className={`kpi ${summary.errors ? 'kpi-bad' : 'kpi-good'}`}><b>{summary.errors}</b><span>z błędami krytycznymi</span></div>
              <div className="kpi"><b>{summary.warns}</b><span>ostrzeżeń</span></div>
              <div className="kpi"><b>{summary.q}/100</b><span>średnia jakość</span></div>
            </div>
            {Object.keys(summary.fixes).length > 0 && (
              <div className="notice notice-info">
                <strong>Naprawiliśmy automatycznie:</strong>
                <ul>{Object.entries(summary.fixes).map(([f, n]) => <li key={f}>{f} {n > 1 && <span className="muted">({n}×)</span>}</li>)}</ul>
              </div>
            )}
            {summary.missingRequired.length > 0 && (
              <div className="notice notice-warn">
                <strong>W pliku brakuje kolumn obowiązkowych:</strong> {summary.missingRequired.map((f) => f.label).join(', ')}.
                <br />Dodaj je do pliku — to informacje, których świadek zdarzenia potrzebuje najbardziej.
              </div>
            )}
            <h3>Zgodność z zasadami dane.gov.pl</h3>
            <ul className="checklist">
              <li className="ok">Format odczytywalny maszynowo (CSV/XLSX/JSON), kodowanie UTF-8</li>
              <li className={summary.missingRequired.some((f) => f.name.includes('geograficzna')) ? 'bad' : 'ok'}>Współrzędne w układzie WGS84 (EPSG:4326)</li>
              <li className="ok">Daty w formacie ISO 8601 (RRRR-MM-DD)</li>
              <li className="ok">Jeden wiersz = jeden AED, stały identyfikator rekordu</li>
              <li className={summary.missingRequired.length ? 'bad' : 'ok'}>Komplet pól obowiązkowych wzorcowego zakresu danych</li>
              <li className="ok">Brak danych osobowych (dane kontaktowe instytucji, nie osób)</li>
            </ul>
            {summary.perIssue.length > 0 && (
              <details>
                <summary>Szczegóły problemów ({summary.perIssue.length} rodzajów)</summary>
                <ul className="issue-list">{summary.perIssue.slice(0, 20).map(([k, n]) => <li key={k}><b>{n}×</b> {k}</li>)}</ul>
              </details>
            )}
            <details>
              <summary>Podgląd danych po konwersji (pierwsze 10 rekordów)</summary>
              <div className="table-wrap">
                <table className="table table-sm">
                  <thead><tr>{['id', 'nazwa', 'szerokosc_geograficzna', 'dlugosc_geograficzna', 'nazwa_ulicy', 'nr_budynku', 'kod_pocztowy', 'miejscowosc', 'opis_lokalizacji'].map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
                  <tbody>{result.slice(0, 10).map((r, i) => <tr key={i}>{['id', 'nazwa', 'szerokosc_geograficzna', 'dlugosc_geograficzna', 'nazwa_ulicy', 'nr_budynku', 'kod_pocztowy', 'miejscowosc', 'opis_lokalizacji'].map((c) => <td key={c}>{r.record[c] || <span className="missing">—</span>}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </details>
          </section>

          <section className="card" aria-labelledby="s3">
            <h2 id="s3">3. Pobierz pliki i opublikuj na dane.gov.pl</h2>
            <p className="btn-row">
              <button className="btn btn-primary" onClick={exportCsv}>Pobierz CSV (standard)</button>
              <button className="btn" onClick={exportXlsx}>Pobierz XLSX</button>
              <button className="btn" onClick={exportJson}>Pobierz JSON</button>
              <button className="btn btn-ghost" onClick={() => download('metadane-dane-gov-pl.json', JSON.stringify(meta, null, 2), 'application/json')}>Metadane (JSON)</button>
              <button className="btn btn-ghost" onClick={exportDcat}>Metadane DCAT-AP (XML do harvestera)</button>
            </p>
            <h3>Gotowy opis zbioru do skopiowania</h3>
            <dl className="facts meta">
              {Object.entries(meta).flatMap(([k, v]) => [<dt key={k}>{k.replace(/_/g, ' ')}</dt>, <dd key={k + 'v'}>{Array.isArray(v) ? v.join(', ') : v}</dd>])}
            </dl>
            <h3>Jak opublikować</h3>
            <ol className="howto">
              <li>Zaloguj się do panelu administracyjnego <a href="https://admin.dane.gov.pl" target="_blank" rel="noopener">admin.dane.gov.pl</a> jako redaktor swojej instytucji (dostęp nadaje pełnomocnik ds. otwartości danych).</li>
              <li>Dodaj zbiór danych: wklej tytuł i opis z sekcji powyżej, dodaj słowo kluczowe <b>AEDostępni</b> (dzięki niemu zbiór trafi automatycznie do krajowej mapy AED), kategoria „Zdrowie”.</li>
              <li>Dodaj zasób: plik CSV (lub link do API/pliku na Twoim serwerze — wtedy aktualizacja jest automatyczna).</li>
              <li>Ustaw częstotliwość aktualizacji i włącz przypomnienia. Gotowe — Twoje AED pojawią się w aplikacji AEDostępni i w zbiorze krajowym przy najbliższej synchronizacji.</li>
            </ol>
          </section>
        </>
      )}
    </div>
  );
}
