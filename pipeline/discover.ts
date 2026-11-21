// Automatyczne wykrywanie zbiorów o AED w portalu dane.gov.pl (API 1.4).
// Uruchom: node pipeline/discover.ts
// Wynik:  pipeline/sources.auto.json — lista źródeł do integracji (+ zbiory odrzucone z przyczyną)
//         pipeline/raw/auto/*        — pobrane zasoby
//
// Reguły:
//  - szukamy po frazach: „defibrylator”, „defibrylatory”, „AED” oraz po słowie kluczowym akcji „AEDostępni”,
//  - z każdego zbioru bierzemy JEDEN zasób odczytywalny maszynowo (CSV > JSON > GeoJSON > XLSX),
//  - zasób, który zamiast danych zwraca stronę HTML, jest oznaczany jako niezgodny (brak danych do pobrania),
//  - dysponent i jego REGON pochodzą z metadanych instytucji w portalu.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://api.dane.gov.pl/1.4';
const ROOT = dirname(fileURLToPath(import.meta.url));
const RAW = join(ROOT, 'raw', 'auto');
mkdirSync(RAW, { recursive: true });

const QUERIES = ['defibrylator', 'defibrylatory', 'AED', 'AEDostępni'];
const FORMAT_PRIORITY = ['csv', 'json', 'geojson', 'xlsx', 'xls'];
const RELEVANT = /defibryl|(^|[^a-z])aed([^a-z]|$)|aedostępni/i;
const UA = { 'User-Agent': 'AEDostepni-discovery/1.0 (open data hackathon prototype)', Accept: 'application/json' };

export interface AutoSource {
  id: string; datasetId: string; resourceId: string; title: string; publisher: string; regon: string; city: string;
  license: string; url: string; downloadUrl: string; file: string; format: string; modified: string; opennessScore: number | null;
}
export interface Rejected { datasetId: string; title: string; publisher: string; url: string; reason: string; }

async function getJson(url: string): Promise<any> {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (r.ok) return await r.json();
    } catch { /* ponów */ }
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  throw new Error(`Nie udało się pobrać ${url}`);
}

async function main() {
  // 1. wyszukanie zbiorów
  const datasets = new Map<string, { attrs: any; inst: any }>();
  for (const q of QUERIES) {
    const d = await getJson(`${API}/datasets?q=${encodeURIComponent(q)}&per_page=100&include=institution`);
    const inst = new Map<string, any>((d.included || []).filter((x: any) => x.type === 'institution').map((x: any) => [x.id, x.attributes]));
    for (const ds of d.data || []) {
      const a = ds.attributes;
      const text = `${a.title} ${(a.keywords || []).join(' ')} ${a.notes || ''}`.replace(/<[^>]+>/g, '');
      if (!RELEVANT.test(text)) continue;
      const instId = ds.relationships?.institution?.data?.id;
      datasets.set(ds.id, { attrs: a, inst: inst.get(instId) || {} });
    }
  }
  // 1b. wyszukiwarka pełnotekstowa zwraca też pojedyncze ZASOBY w ogólnych zbiorach (np. AED jako zasób zbioru „Zdrowie”)
  const resourceHits = new Map<string, Set<string>>(); // datasetId → resourceIds
  for (const q of QUERIES) {
    const d = await getJson(`${API}/search?q=${encodeURIComponent(q)}&per_page=100`);
    for (const x of d.data || []) {
      if (x.attributes?.model !== 'resource') continue;
      const t = String(x.attributes.title || '').replace(/<[^>]+>/g, '');
      if (!RELEVANT.test(t)) continue;
      const dsId = x.relationships?.dataset?.data?.id;
      if (!dsId) continue;
      if (!resourceHits.has(dsId)) resourceHits.set(dsId, new Set());
      resourceHits.get(dsId)!.add(String(x.id));
      if (!datasets.has(dsId)) {
        const ds = await getJson(`${API}/datasets/${dsId}?include=institution`);
        const inst = (ds.included || []).find((i: any) => i.type === 'institution')?.attributes || {};
        datasets.set(dsId, { attrs: { ...ds.data.attributes, title: t }, inst });
      }
    }
  }
  console.log(`Znaleziono ${datasets.size} zbiorów o AED w dane.gov.pl`);

  const sources: AutoSource[] = [];
  const rejected: Rejected[] = [];
  for (const [id, { attrs, inst }] of datasets) {
    const title = String(attrs.title).replace(/<[^>]+>/g, '');
    const publisher = inst.title || 'nieznana instytucja';
    const url = `https://dane.gov.pl/pl/dataset/${id}`;
    const res = await getJson(`${API}/datasets/${id}/resources?per_page=50`);
    const candidates = (res.data || [])
      .map((r: any) => ({ id: r.id, a: r.attributes }))
      .filter((r: any) => FORMAT_PRIORITY.includes(String(r.a.format || '').toLowerCase()))
      .filter((r: any) => !resourceHits.has(id) || resourceHits.get(id)!.has(String(r.id)) || RELEVANT.test(String(r.a.title || '')))
      .sort((x: any, y: any) => FORMAT_PRIORITY.indexOf(x.a.format.toLowerCase()) - FORMAT_PRIORITY.indexOf(y.a.format.toLowerCase())
        || String(y.a.data_date || '').localeCompare(String(x.a.data_date || '')));
    if (!candidates.length) { rejected.push({ datasetId: id, title, publisher, url, reason: 'Brak zasobu w formacie odczytywalnym maszynowo (CSV/JSON/GeoJSON/XLSX).' }); continue; }

    let picked: AutoSource | null = null;
    let lastReason = '';
    for (const c of candidates) {
      const fmt = c.a.format.toLowerCase();
      const dl = c.a.download_url || c.a.link;
      try {
        const r = await fetch(dl, { headers: { 'User-Agent': UA['User-Agent'] }, redirect: 'follow' });
        const buf = Buffer.from(await r.arrayBuffer());
        const head = buf.subarray(0, 300).toString('utf8').trimStart().toLowerCase();
        if (!r.ok) { lastReason = `Zasób zwraca błąd HTTP ${r.status}.`; continue; }
        if (head.startsWith('<!doctype html') || head.startsWith('<html')) { lastReason = 'Zasób opisany jako dane, ale link prowadzi do strony WWW, a nie do pliku z danymi.'; continue; }
        const file = `auto/${c.id}.${fmt === 'xls' ? 'xlsx' : fmt}`;
        writeFileSync(join(ROOT, 'raw', file), buf);
        picked = {
          id: `dgp-${c.id}`, datasetId: id, resourceId: c.id, title, publisher, regon: inst.regon || '', city: inst.city || '',
          license: attrs.license_name || attrs.license_chosen || 'zgodnie z dane.gov.pl', url, downloadUrl: dl, file, format: fmt,
          modified: String(c.a.data_date || attrs.modified || '').slice(0, 10), opennessScore: c.a.openness_score ?? null,
        };
        break;
      } catch (e) { lastReason = `Nie udało się pobrać zasobu (${(e as Error).message}).`; }
    }
    if (picked) { sources.push(picked); console.log(`✓ ${publisher}: ${title} [${picked.format}]`); }
    else { rejected.push({ datasetId: id, title, publisher, url, reason: lastReason }); console.log(`✕ ${publisher}: ${title} — ${lastReason}`); }
  }

  writeFileSync(join(ROOT, 'sources.auto.json'), JSON.stringify({ wygenerowano: new Date().toISOString(), zrodla: sources, odrzucone: rejected }, null, 2));
  console.log(`\n= ${sources.length} źródeł do integracji, ${rejected.length} odrzuconych → pipeline/sources.auto.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
