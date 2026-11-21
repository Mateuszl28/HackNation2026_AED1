// Pipeline integracji danych o AED: pobranie → mapowanie do standardu → walidacja → deduplikacja → publikacja.
// Uruchom: node pipeline/build.ts [--fetch]
//   --fetch  pobiera świeże pliki ze źródeł (dane.gov.pl API, OpenAEDMap) przed budową.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { FIELDS, INTEGRATED_EXTRA_FIELDS, SCHEMA_VERSION } from '../shared/schema.ts';
import type { AedRecord } from '../shared/schema.ts';
import { parseCsv, parseJson, autoMap, mapRow, osmToRecord, qualityScore, flattenRow, datasetChecks } from '../shared/mapper.ts';
import type { Issue } from '../shared/mapper.ts';
import { SOURCES, KIND_PRIORITY } from './sources.ts';
import type { SourceDef } from './sources.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'pipeline', 'raw');
const OUT = join(ROOT, 'data');
const APP_OUT = join(ROOT, 'web', 'public', 'data');
mkdirSync(OUT, { recursive: true });
mkdirSync(APP_OUT, { recursive: true });

const MATCH_RADIUS_M = 35;

interface Rec { rec: AedRecord; source: SourceDef; issues: Issue[]; fixes: string[]; }
interface SourceReport {
  id: string; title: string; publisher: string; kind: string; license: string; url: string; format: string;
  rows: number; valid: number; rejected: number; matchedExisting: number; newRecords: number;
  rejectedExamples: string[]; autoFixes: Record<string, number>; topIssues: Record<string, number>; mapping: Record<string, string>; avgQuality: number;
}

async function fetchSources() {
  for (const s of SOURCES) {
    if (!s.downloadUrl) continue;
    process.stdout.write(`↓ ${s.id} … `);
    try {
      const r = await fetch(s.downloadUrl, { headers: { 'User-Agent': 'AEDostepni-pipeline/1.0 (hackathon prototype)' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      writeFileSync(join(RAW, s.file), Buffer.from(await r.arrayBuffer()));
      console.log('ok');
    } catch (e) { console.log(`błąd (${(e as Error).message}) — używam kopii lokalnej`); }
  }
}

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b[0] - a[0]) * toR, dLon = (b[1] - a[1]) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function loadSource(s: SourceDef): { recs: Rec[]; report: SourceReport } {
  const text = readFileSync(join(RAW, s.file), 'utf8');
  const report: SourceReport = {
    id: s.id, title: s.title, publisher: s.publisher, kind: s.kind, license: s.license, url: s.url, format: s.format,
    rows: 0, valid: 0, rejected: 0, rejectedExamples: [], matchedExisting: 0, newRecords: 0, autoFixes: {}, topIssues: {}, mapping: {}, avgQuality: 0,
  };
  const recs: Rec[] = [];
  if (s.format === 'geojson-osm') {
    const gj = JSON.parse(text);
    for (const f of gj.features) {
      const [lon, lat] = f.geometry.coordinates;
      const rec = osmToRecord(f.properties, lon, lat);
      recs.push({ rec, source: s, issues: [], fixes: [] });
    }
    report.rows = recs.length;
    report.mapping = { 'tagi OSM (emergency=defibrillator)': 'wg kolumny „osm” w standardzie' };
  } else {
    const parsed = s.format === 'csv' ? parseCsv(text) : parseJson(text);
    const rows = parsed.rows.map(flattenRow);
    const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r)))).filter((h) => !h.startsWith('__'));
    const mapping = { ...autoMap(headers, rows), ...(s.mappingOverrides || {}) };
    report.mapping = Object.fromEntries(Object.entries(mapping).filter(([, v]) => v));
    report.rows = rows.length;
    for (const f of parsed.fixes) report.autoFixes[f] = (report.autoFixes[f] || 0) + 1;
    for (const row of rows) {
      const m = mapRow(row, mapping, s.defaults);
      for (const f of m.fixes) report.autoFixes[f] = (report.autoFixes[f] || 0) + 1;
      recs.push({ rec: m.record, source: s, issues: m.issues, fixes: m.fixes });
    }
    datasetChecks(recs.map((r) => r.rec)).forEach((iss, i) => recs[i].issues.push(...iss));
  }
  return { recs, report };
}

function key(lat: number, lon: number) { return `${Math.round(lat * 500)}:${Math.round(lon * 300)}`; }

async function main() {
  if (process.argv.includes('--fetch')) await fetchSources();
  const today = new Date().toISOString().slice(0, 10);

  // Kolejność: najpierw źródła o najwyższym priorytecie (dane dysponentów są referencyjne).
  const ordered = [...SOURCES].sort((a, b) => KIND_PRIORITY[b.kind] - KIND_PRIORITY[a.kind]);
  const integrated: { rec: AedRecord; sources: string[]; main: SourceDef; lat: number; lon: number; issues: Issue[] }[] = [];
  const grid = new Map<string, number[]>();
  const reports: SourceReport[] = [];

  for (const s of ordered) {
    if (!existsSync(join(RAW, s.file))) { console.warn(`! brak pliku ${s.file} — pomijam ${s.id}`); continue; }
    const { recs, report } = loadSource(s);
    let qsum = 0;
    for (const r of recs) {
      const lat = Number(r.rec.szerokosc_geograficzna), lon = Number(r.rec.dlugosc_geograficzna);
      const errs = r.issues.filter((i) => i.level === 'error' && (i.field.includes('geograficzna') || i.field === 'nazwa'));
      if (errs.length) report.rejectedExamples.push(`${r.rec.id || '?'} ${r.rec.nazwa || ''}: ${errs[0].message}`);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || errs.length) {
        report.rejected++;
        for (const i of r.issues) report.topIssues[i.message] = (report.topIssues[i.message] || 0) + 1;
        continue;
      }
      report.valid++;
      for (const i of r.issues) { const k = i.message.startsWith('Brak pola') ? i.message : i.message.replace(/„[^”]*”/g, '„…”').replace(/\(\d{4}-\d{2}-\d{2}\)/, ''); report.topIssues[k] = (report.topIssues[k] || 0) + 1; }
      qsum += qualityScore(r.rec);
      // deduplikacja: szukamy istniejącego AED w promieniu MATCH_RADIUS_M
      let found = -1, best = Infinity;
      const [gy, gx] = key(lat, lon).split(':').map(Number);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        for (const idx of grid.get(`${gy + dy}:${gx + dx}`) || []) {
          const it = integrated[idx];
          if (it.sources.some((x) => x.startsWith(s.id + ':'))) continue; // nie scalamy w obrębie jednego źródła
          const d = haversine([lat, lon], [it.lat, it.lon]);
          if (d < MATCH_RADIUS_M && d < best) { best = d; found = idx; }
        }
      }
      const srcRef = `${s.id}:${r.rec.id || ''}`;
      if (found >= 0) {
        const it = integrated[found];
        for (const [k, v] of Object.entries(r.rec)) if (v && !it.rec[k]) it.rec[k] = v; // uzupełnianie luk
        it.sources.push(srcRef);
        report.matchedExisting++;
      } else {
        const idx = integrated.push({ rec: { ...r.rec }, sources: [srcRef], main: s, lat, lon, issues: r.issues }) - 1;
        const k = key(lat, lon);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k)!.push(idx);
        report.newRecords++;
      }
    }
    report.avgQuality = report.valid ? Math.round(qsum / report.valid) : 0;
    report.topIssues = Object.fromEntries(Object.entries(report.topIssues).sort((a, b) => b[1] - a[1]).slice(0, 8));
    reports.push(report);
    console.log(`✓ ${s.id}: ${report.rows} wierszy, ${report.valid} poprawnych, ${report.matchedExisting} scalonych, ${report.newRecords} nowych`);
  }

  // finalizacja rekordów
  const final = integrated.map((it) => {
    const r: Record<string, string> = {};
    for (const f of FIELDS) r[f.name] = it.rec[f.name] || '';
    if (!r.data_aktualizacji) r.data_aktualizacji = today;
    if (!r.stan) r.stan = 'nieznany';
    if (!r.dostep) r.dostep = 'nieznany';
    if (!r.zabezpieczenie) r.zabezpieczenie = 'nieznane';
    r.aed_uid = 'PL-AED-' + it.sources[0].replace(/[^A-Za-z0-9]+/g, '-').replace(/-+$/, '');
    r.zrodla = it.sources.join('|');
    r.zrodlo_glowne = it.main.id;
    r.jakosc = String(qualityScore(r));
    return r;
  });
  final.sort((a, b) => a.aed_uid.localeCompare(b.aed_uid));

  const cols = [...INTEGRATED_EXTRA_FIELDS.map((f) => f.name), ...FIELDS.map((f) => f.name)];

  // CSV (UTF-8, separator przecinek, RFC 4180) — format zalecany przez dane.gov.pl
  const esc = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  writeFileSync(join(OUT, 'aed.csv'), '﻿' + [cols.join(','), ...final.map((r) => cols.map((c) => esc(r[c] || '')).join(','))].join('\r\n'));
  // JSON (puste pola pomijane — pełna lista kolumn w datapackage.json)
  const compact = (r: Record<string, string>) => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== ''));
  writeFileSync(join(OUT, 'aed.json'), JSON.stringify({ wersja_standardu: SCHEMA_VERSION, data_wygenerowania: today, liczba_rekordow: final.length, dane: final.map(compact) }));
  // GeoJSON (RFC 7946)
  writeFileSync(join(OUT, 'aed.geojson'), JSON.stringify({
    type: 'FeatureCollection',
    features: final.map((r) => ({ type: 'Feature', id: r.aed_uid, geometry: { type: 'Point', coordinates: [Number(r.dlugosc_geograficzna), Number(r.szerokosc_geograficzna)] }, properties: compact(r) })),
  }));
  // XLSX
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AEDostępni'; wb.created = new Date();
  const ws = wb.addWorksheet('aed', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = cols.map((c) => ({ header: c, key: c, width: Math.min(40, Math.max(12, c.length + 2)) }));
  ws.addRows(final);
  ws.getRow(1).font = { bold: true };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  await wb.xlsx.writeFile(join(OUT, 'aed.xlsx'));

  // Raport źródeł + statystyki
  const stats = {
    data_wygenerowania: today,
    wersja_standardu: SCHEMA_VERSION,
    liczba_aed: final.length,
    z_wieloma_zrodlami: final.filter((r) => r.zrodla.includes('|')).length,
    calodobowe: final.filter((r) => /^24\/7$/.test(r.godziny_dostepnosci)).length,
    bez_godzin: final.filter((r) => !r.godziny_dostepnosci).length,
    bez_opisu_lokalizacji: final.filter((r) => !r.opis_lokalizacji).length,
    publiczne: final.filter((r) => r.dostep === 'publiczny').length,
    z_data_kontroli: final.filter((r) => r.data_ostatniej_kontroli).length,
    srednia_jakosc: Math.round(final.reduce((s, r) => s + Number(r.jakosc), 0) / final.length),
    zrodla: reports,
  };
  writeFileSync(join(OUT, 'zrodla-raport.json'), JSON.stringify(stats, null, 2));

  // Wersja kompaktowa dla aplikacji (mapa)
  const APP_COLS = ['aed_uid', 'szerokosc_geograficzna', 'dlugosc_geograficzna', 'nazwa', 'opis_lokalizacji', 'nazwa_ulicy', 'nr_budynku', 'miejscowosc',
    'godziny_dostepnosci', 'dostep', 'zabezpieczenie', 'dysponent', 'telefon_kontaktowy', 'data_ostatniej_kontroli', 'zrodla', 'jakosc', 'kondygnacja', 'wewnatrz_budynku', 'zdjecie_url', 'stan', 'elektrody_dzieciece', 'instrukcja_dostepu'];
  writeFileSync(join(APP_OUT, 'aed-app.json'), JSON.stringify({ cols: APP_COLS, generated: today, rows: final.map((r) => APP_COLS.map((c) => (c.includes('geograficzna') ? Number(Number(r[c]).toFixed(6)) : r[c] || ''))) }));
  writeFileSync(join(APP_OUT, 'stats.json'), JSON.stringify(stats));
  for (const f of ['aed.csv', 'aed.json', 'aed.geojson', 'aed.xlsx']) writeFileSync(join(APP_OUT, f), readFileSync(join(OUT, f)));

  console.log(`\n= Zbiór krajowy: ${final.length} AED (${stats.z_wieloma_zrodlami} potwierdzonych w ≥2 źródłach), średnia jakość ${stats.srednia_jakosc}/100`);
}

main().catch((e) => { console.error(e); process.exit(1); });
