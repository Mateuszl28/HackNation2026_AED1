import { useState } from 'react';
import { PUBLIC_URL } from '../config';

const BASE = `${PUBLIC_URL}data/`;
const FILES: { file: string; what: string; format: string }[] = [
  { file: 'aed.csv', what: 'Zbiór krajowy AED — wszystkie pola standardu + pochodzenie i jakość', format: 'CSV (UTF-8, RFC 4180)' },
  { file: 'aed.json', what: 'To samo w JSON (puste pola pominięte)', format: 'JSON' },
  { file: 'aed.geojson', what: 'To samo jako warstwa punktowa (WGS84)', format: 'GeoJSON (RFC 7946)' },
  { file: 'aed.xlsx', what: 'To samo w arkuszu', format: 'XLSX' },
  { file: 'dcat.xml', what: 'Metadane zbioru do harvestingu', format: 'DCAT-AP (RDF/XML)' },
  { file: 'stats.json', what: 'Statystyki i raport źródeł (wiersze, scalenia, naprawy, problemy)', format: 'JSON' },
  { file: 'regiony.json', what: 'Wskaźniki dla 16 województw (indeks gotowości danych)', format: 'JSON' },
  { file: 'powiaty.json', what: 'Wskaźniki dla 380 powiatów', format: 'JSON' },
];

const EXAMPLES: Record<string, string> = {
  curl: `curl -L -o aed.csv ${BASE}aed.csv`,
  Python: `import pandas as pd

aed = pd.read_csv("${BASE}aed.csv")
# AED dostępne całodobowo w województwie kujawsko-pomorskim
calodobowe = aed[(aed.godziny_dostepnosci == "24/7") & (aed.wojewodztwo == "kujawsko-pomorskie")]
print(len(calodobowe), "AED 24/7")`,
  JavaScript: `const res = await fetch("${BASE}aed.geojson");
const { features } = await res.json();
// 5 najbliższych AED od punktu (lat, lon)
const [lat, lon] = [53.1235, 18.0084];
const d = (f) => Math.hypot(f.geometry.coordinates[1] - lat, (f.geometry.coordinates[0] - lon) * Math.cos(lat * Math.PI / 180));
console.log(features.sort((a, b) => d(a) - d(b)).slice(0, 5).map((f) => f.properties.nazwa));`,
};

const RECORD = `{
  "aed_uid": "PL-AED-dgp-54632-1",            // stały identyfikator w zbiorze krajowym
  "zrodla": "dgp-54632:1|osm:node/9457610211", // wszystkie źródła potwierdzające ten AED
  "zrodlo_glowne": "dgp-54632",                // źródło referencyjne (dysponent > rejestr > społeczność)
  "jakosc": "57",                              // wskaźnik jakości 0–100
  "nazwa": "Zespół Krytych Pływalni",
  "szerokosc_geograficzna": "49.718809",       // WGS84
  "dlugosc_geograficzna": "21.720344",
  "opis_lokalizacji": "wewnątrz budynku, w pomieszczeniu ratowników",
  "nazwa_ulicy": "Jasna", "miejscowosc": "Krosno", "wojewodztwo": "podkarpackie",
  "dostep": "dla_klientow", "godziny_dostepnosci": "Mo-Fr 06:00-22:00",
  "zabezpieczenie": "nieznane", "stan": "nieznany", "dysponent": "Gmina Miasto Krosno",
  "data_aktualizacji": "2026-11-21"
}`;

export default function DevPage() {
  const [tab, setTab] = useState<keyof typeof EXAMPLES>('curl');
  const [copied, setCopied] = useState('');
  async function copy(t: string, k: string) { try { await navigator.clipboard.writeText(t); setCopied(k); setTimeout(() => setCopied(''), 1500); } catch { /* brak schowka */ } }

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Dla deweloperów · otwarte dane</p>
        <h1>Wykorzystaj dane o AED w swojej aplikacji</h1>
        <p className="lead">Zbiór krajowy jest aktualizowany co noc i dostępny pod stałymi adresami — bez klucza API i bez rejestracji.</p>
      </header>

      <section className="card" aria-labelledby="dev-files">
        <h2 id="dev-files">Pliki pod stałymi adresami</h2>
        <div className="table-wrap">
          <table className="table stack">
            <caption className="sr-only">Pliki z danymi</caption>
            <thead><tr><th scope="col">Plik</th><th scope="col">Zawartość</th><th scope="col">Format</th></tr></thead>
            <tbody>
              {FILES.map((f) => (
                <tr key={f.file}>
                  <th scope="row"><a href={`./data/${f.file}`} download>{f.file}</a><br /><button className="btn btn-sm btn-ghost" style={{ marginTop: 6 }} onClick={() => copy(BASE + f.file, f.file)}>{copied === f.file ? 'Skopiowano ✓' : 'Kopiuj adres'}</button></th>
                  <td data-label="Zawartość">{f.what}</td>
                  <td data-label="Format">{f.format}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">Adres bazowy: <code>{BASE}</code>. Opis wszystkich kolumn: <a href="./standard/datapackage.json" download>datapackage.json</a> (Table Schema) i <a href="#/dane">wzorcowy zakres danych</a>.</p>
      </section>

      <section className="card" aria-labelledby="dev-ex">
        <h2 id="dev-ex">Przykłady</h2>
        <div className="metric-tabs" role="tablist" aria-label="Język przykładu">
          {(Object.keys(EXAMPLES) as (keyof typeof EXAMPLES)[]).map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{k}</button>
          ))}
        </div>
        <pre className="code" tabIndex={0} aria-label={`Przykład: ${tab}`}><code>{EXAMPLES[tab]}</code></pre>
        <button className="btn btn-sm" onClick={() => copy(EXAMPLES[tab], 'ex')}>{copied === 'ex' ? 'Skopiowano ✓' : 'Kopiuj kod'}</button>
      </section>

      <section className="card" aria-labelledby="dev-rec">
        <h2 id="dev-rec">Struktura rekordu</h2>
        <pre className="code" tabIndex={0} aria-label="Przykładowy rekord JSON"><code>{RECORD}</code></pre>
      </section>

      <section className="card" aria-labelledby="dev-rules">
        <h2 id="dev-rules">Zasady</h2>
        <ul className="howto">
          <li><b>Aktualizacja:</b> codziennie ok. 04:00 (GitHub Actions: wykrycie zbiorów w API dane.gov.pl → integracja → publikacja).</li>
          <li><b>Identyfikatory:</b> <code>aed_uid</code> jest stały między aktualizacjami — możesz po nim łączyć własne dane.</li>
          <li><b>Licencja:</b> dane dysponentów — zgodnie z licencją zbioru w dane.gov.pl; dane pochodzące z OpenStreetMap — ODbL 1.0 (© współtwórcy OpenStreetMap): wymagane uznanie autorstwa i udostępnianie na tych samych warunkach.</li>
          <li><b>Odpowiedzialne użycie:</b> w aplikacjach ratunkowych pokazuj datę aktualizacji i źródło danych; brak informacji o godzinach nie oznacza, że AED jest dostępny.</li>
        </ul>
      </section>
    </div>
  );
}
