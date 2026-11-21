import { useEffect, useState } from 'react';
import { FIELDS, SCHEMA_VERSION } from '@shared/schema.ts';
import { loadStats } from '../data';
import type { Stats } from '../data';

const KIND: Record<string, string> = { dysponent: 'Dysponent (referencyjne)', rejestr: 'Rejestr publiczny', spolecznosc: 'Społeczność' };
const pct = (a: number, b: number) => `${Math.round((a / b) * 100)}%`;

// Przegląd źródeł (stan zastany podczas hackathonu) — ok: true = zintegrowane, false = niedostępne maszynowo, null = częściowo
const LANDSCAPE: { name: string; url?: string; who: string; form: string; status: string; ok: boolean | null }[] = [
  { name: 'dane.gov.pl — zbiory gmin (Krosno, Przemyśl, Marki, Legionowo)', url: 'https://dane.gov.pl/pl/search?q=defibrylator', who: 'urzędy miast', form: 'CSV / JSON / XML / XLSX, każdy w innym układzie', status: 'zintegrowane automatycznie', ok: true },
  { name: 'dane.gov.pl — Warszawa', url: 'https://dane.gov.pl/pl/dataset/39512', who: 'Urząd m.st. Warszawy', form: 'link do strony katalogu zamiast pliku', status: 'niepobieralne maszynowo', ok: false },
  { name: 'OpenStreetMap (eksport OpenAEDMap)', url: 'https://openaedmap.org/pl/', who: 'społeczność OSM', form: 'GeoJSON, tagi emergency=defibrillator', status: 'zintegrowane (ODbL)', ok: true },
  { name: 'Geoportal krajowy — warstwa „Defibrylatory”', url: 'https://www.geoportal.gov.pl/aktualnosci/swiatowy-dzien-pierwszej-pomocy/', who: 'GUGiK (na bazie danych OSM Polska)', form: 'warstwa w przeglądarce mapowej', status: 'podgląd na mapie, bez otwartego zbioru', ok: null },
  { name: 'Miejskie mapy AED (np. Warszawa, Wrocław)', who: 'urzędy miast', form: 'mapy na stronach WWW', status: 'brak eksportu danych', ok: false },
  { name: 'Sieci firmowe (np. placówki pocztowe, galerie, przewoźnicy)', who: 'dysponenci prywatni', form: 'wewnętrzne rejestry', status: 'nieopublikowane — cel akcji AEDostępni', ok: false },
];

export default function DataPage() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => { loadStats().then(setS); }, []);

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Otwarte dane · wersja standardu {SCHEMA_VERSION}</p>
        <h1>Krajowy zbiór danych o AED</h1>
        <p className="lead">Jeden zbiór z wielu rozproszonych źródeł. Każdy rekord ma wskazane źródło i ocenę jakości. Formaty odczytywalne maszynowo, zgodnie z zasadami dane.gov.pl.</p>
      </header>

      {s && (
        <>
          <section className="kpis kpis-lg" aria-label="Statystyki zbioru">
            <div className="kpi"><b>{s.liczba_aed.toLocaleString('pl-PL')}</b><span>AED w zbiorze</span></div>
            <div className="kpi"><b>{s.zrodla.length}</b><span>zintegrowanych źródeł</span></div>
            <div className="kpi"><b>{pct(s.calodobowe, s.liczba_aed)}</b><span>dostępnych 24/7</span></div>
            <div className="kpi kpi-bad"><b>{pct(s.bez_godzin, s.liczba_aed)}</b><span>bez informacji o godzinach</span></div>
            <div className="kpi kpi-bad"><b>{pct(s.liczba_aed - s.z_data_kontroli, s.liczba_aed)}</b><span>bez daty kontroli</span></div>
            <div className="kpi"><b>{s.srednia_jakosc}/100</b><span>średnia jakość rekordu</span></div>
          </section>
          <p className="notice notice-info">Luki widoczne powyżej to powód, dla którego potrzebujemy danych od dysponentów. Dane społecznościowe mówią, <em>gdzie</em> jest AED, ale tylko dysponent wie, czy jest sprawny, kiedy był kontrolowany i czy szafka jest otwarta. <a href="#/ranking"><b>Zobacz mapę luk w danych wg województw →</b></a></p>

          <section className="card" aria-labelledby="dl">
            <h2 id="dl">Pobierz zbiór</h2>
            <p className="btn-row">
              <a className="btn btn-primary" href="./data/aed.csv" download>CSV (UTF-8)</a>
              <a className="btn" href="./data/aed.xlsx" download>XLSX</a>
              <a className="btn" href="./data/aed.json" download>JSON</a>
              <a className="btn" href="./data/aed.geojson" download>GeoJSON</a>
              <a className="btn btn-ghost" href="./standard/datapackage.json" download>Table Schema (datapackage.json)</a>
              <a className="btn btn-ghost" href="./data/dcat.xml" download>Metadane DCAT-AP (XML)</a>
              <a className="btn btn-ghost" href="./standard/aed-wzorcowy-zakres-danych.xlsx" download>Wzorcowy zakres danych (XLSX)</a>
            </p>
            <p className="muted">Wygenerowano: {s.data_wygenerowania}. Licencje: dane dysponentów — zgodnie z licencją zbioru na dane.gov.pl; dane OpenStreetMap — ODbL 1.0 (© współtwórcy OpenStreetMap), co wymaga uznania autorstwa i udostępniania na tych samych warunkach.</p>
          </section>

          <section className="card" aria-labelledby="src">
            <h2 id="src">Źródła i ich zakres referencyjny</h2>
            <p>Przy scalaniu obowiązuje hierarchia: <b>dysponent</b> (dane referencyjne) → <b>rejestr publiczny</b> → <b>społeczność</b>. AED z różnych źródeł położone bliżej niż 35 m są łączone w jeden rekord, a brakujące pola uzupełniane są z kolejnych źródeł.</p>
            <div className="table-wrap">
              <table className="table stack">
                <caption className="sr-only">Źródła danych</caption>
                <thead><tr><th scope="col">Źródło</th><th scope="col">Typ</th><th scope="col">Format</th><th scope="col">Wiersze</th><th scope="col">Poprawne</th><th scope="col">Scalone z innymi</th><th scope="col">Nowe AED</th><th scope="col">Jakość</th></tr></thead>
                <tbody>
                  {s.zrodla.map((z) => (
                    <tr key={z.id}>
                      <th scope="row"><a href={z.url} target="_blank" rel="noopener">{z.title}</a><br /><small className="muted">{z.publisher} · {z.license}</small></th>
                      <td data-label="Typ">{KIND[z.kind]}</td><td data-label="Format">{z.format.toUpperCase().replace('GEOJSON-OSM', 'GeoJSON')}</td>
                      <td data-label="Wiersze">{z.rows.toLocaleString('pl-PL')}</td><td data-label="Poprawne">{z.valid.toLocaleString('pl-PL')}</td>
                      <td data-label="Scalone">{z.matchedExisting.toLocaleString('pl-PL')}</td><td data-label="Nowe AED">{z.newRecords.toLocaleString('pl-PL')}</td><td data-label="Jakość">{z.avgQuality}/100</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {s.zrodla.filter((z) => Object.keys(z.autoFixes).length || Object.keys(z.topIssues).length || z.rejectedExamples.length).map((z) => (
              <details key={z.id}>
                <summary>{z.title}: automatyczne poprawki i problemy</summary>
                {Object.keys(z.autoFixes).length > 0 && <ul>{Object.entries(z.autoFixes).map(([k, n]) => <li key={k}>✔ {k} <span className="muted">({n}×)</span></li>)}</ul>}
                {z.rejectedExamples.length > 0 && <ul>{z.rejectedExamples.map((k) => <li key={k}>✕ <b>Odrzucono:</b> {k}</li>)}</ul>}
                <ul>{Object.entries(z.topIssues).map(([k, n]) => <li key={k}>⚠ {k} <span className="muted">({n}×)</span></li>)}</ul>
              </details>
            ))}
          </section>

          {s.odrzucone_zbiory?.length > 0 && (
            <section className="card" aria-labelledby="rej">
              <h2 id="rej">Zbiory wykryte, ale niemożliwe do zintegrowania</h2>
              <p>Te zbiory są w dane.gov.pl, ale nie spełniają warunku danych odczytywalnych maszynowo. Wystarczy, że dysponent poprawi zasób, a przy najbliższej synchronizacji jego AED pojawią się w zbiorze krajowym.</p>
              <ul className="issue-list">
                {s.odrzucone_zbiory.map((z) => <li key={z.datasetId}><a href={z.url} target="_blank" rel="noopener">{z.publisher}: {z.title}</a> — {z.reason}</li>)}
              </ul>
            </section>
          )}
        </>
      )}

      <section className="card" aria-labelledby="landscape">
        <h2 id="landscape">Przegląd źródeł danych o AED w Polsce</h2>
        <p>Stan rozproszenia danych, który zastaliśmy (listopad 2026). Zbiór krajowy AEDostępni łączy wszystkie źródła, które da się pobrać maszynowo. Pozostałe pokazują, gdzie dane istnieją, ale nie są otwarte.</p>
        <div className="table-wrap">
          <table className="table stack">
            <caption className="sr-only">Źródła danych o AED w Polsce i ich status</caption>
            <thead><tr><th scope="col">Źródło</th><th scope="col">Kto prowadzi</th><th scope="col">Postać danych</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {LANDSCAPE.map((r) => (
                <tr key={r.name}>
                  <th scope="row">{r.url ? <a href={r.url} target="_blank" rel="noopener">{r.name}</a> : r.name}</th>
                  <td data-label="Kto prowadzi">{r.who}</td>
                  <td data-label="Postać danych">{r.form}</td>
                  <td data-label="Status"><span className={`badge ${r.ok === true ? 'badge-open' : r.ok === false ? 'badge-closed' : 'badge-unknown'}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" aria-labelledby="std">
        <h2 id="std">Wzorcowy zakres danych ({FIELDS.length} pól)</h2>
        <p><b>O</b> — obowiązkowe, <b>Z</b> — zalecane, <b>F</b> — fakultatywne. Nazwy kolumn bez polskich znaków, daty ISO 8601, współrzędne WGS84, adres zgodny z rejestrem TERYT, godziny w składni <code>opening_hours</code> (zgodność z OpenStreetMap).</p>
        <div className="table-wrap">
          <table className="table table-sm stack">
            <caption className="sr-only">Pola standardu</caption>
            <thead><tr><th scope="col">Kolumna</th><th scope="col">Opis</th><th scope="col">Typ</th><th scope="col">Wym.</th><th scope="col">Przykład</th></tr></thead>
            <tbody>
              {FIELDS.map((f) => (
                <tr key={f.name}>
                  <th scope="row"><code>{f.name}</code><br /><small>{f.label}</small></th>
                  <td className="full">{f.description}{f.enumValues && <><br /><small className="muted">Słownik: {f.enumValues.join(', ')}</small></>}</td>
                  <td data-label="Typ">{f.type}</td><td data-label="Wymagalność"><span className={`req req-${f.req}`}>{f.req}</span></td><td data-label="Przykład"><code>{f.example}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" aria-labelledby="api">
        <h2 id="api">Automatyczne zbieranie z dane.gov.pl</h2>
        <p>Moduł wykrywania (<code>pipeline/discover.ts</code>) przeszukuje API portalu i <b>sam znajduje zbiory oraz pojedyncze zasoby o AED</b>, także ukryte w ogólnych zbiorach (np. Legionowo publikuje AED jako zasób zbioru „Zdrowie”). Z każdego zbioru wybiera zasób odczytywalny maszynowo (CSV → JSON → GeoJSON → XLSX), sprawdza, czy link prowadzi do danych, a nie do strony WWW, pobiera dysponenta i jego REGON z metadanych instytucji, a następnie przekazuje dane do pipeline integracji. Dysponent publikuje raz, z tagiem <b>AEDostępni</b>, a resztę robi automat.</p>
        <pre className="code"><code>{[
          'GET https://api.dane.gov.pl/1.4/datasets?q=defibrylator&include=institution',
          'GET https://api.dane.gov.pl/1.4/search?q=AEDostępni',
          'GET https://api.dane.gov.pl/1.4/datasets/{id}/resources',
        ].join('\n')}</code></pre>
        <p className="muted">Uruchomienie: <code>npm run data:fetch</code> (wykrywanie + pobranie + integracja). W repozytorium działa to codziennie jako GitHub Action.</p>
      </section>
    </div>
  );
}
