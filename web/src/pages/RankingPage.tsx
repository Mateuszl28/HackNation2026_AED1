import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';

type Level = 'woj' | 'pow';
interface Row {
  key: string; name: string; sub: string; aed: number; na_100_tys?: number; z_godzinami_pct: number; z_opisem_pct: number;
  z_kontrola_pct: number; od_dysponentow_pct: number; indeks_gotowosci: number;
}
type Metric = 'indeks_gotowosci' | 'na_100_tys' | 'z_godzinami_pct' | 'z_kontrola_pct' | 'od_dysponentow_pct' | 'aed';
const METRICS: { key: Metric; label: string; unit: string; help: string; levels: Level[] }[] = [
  { key: 'indeks_gotowosci', label: 'Indeks gotowości danych', unit: '/100', help: '30% godziny dostępności + 30% opis miejsca + 20% data kontroli + 20% dane od dysponenta', levels: ['woj', 'pow'] },
  { key: 'na_100_tys', label: 'AED na 100 tys. mieszkańców', unit: '', help: 'Liczba znanych AED w przeliczeniu na ludność (GUS 2023)', levels: ['woj'] },
  { key: 'aed', label: 'Liczba AED', unit: '', help: 'Liczba znanych AED w zbiorze krajowym', levels: ['pow'] },
  { key: 'z_godzinami_pct', label: 'AED z godzinami', unit: '%', help: 'Czy ratujący wie, że AED jest dostępny TERAZ', levels: ['woj', 'pow'] },
  { key: 'z_kontrola_pct', label: 'AED z datą kontroli', unit: '%', help: 'Czy wiadomo, że urządzenie jest sprawne', levels: ['woj', 'pow'] },
  { key: 'od_dysponentow_pct', label: 'Z danych dysponentów', unit: '%', help: 'Udział AED potwierdzonych w zbiorach dysponentów na dane.gov.pl', levels: ['woj', 'pow'] },
];
// Sekwencyjna skala w jednym odcieniu (zieleń marki), jasna → ciemna
const RAMP = ['#CFE8D8', '#A6D6B9', '#7FC49C', '#3FA06B', '#007A3D', '#00522A'];
const PAGE = 20;

export default function RankingPage() {
  const [level, setLevel] = useState<Level>('woj');
  const [data, setData] = useState<Record<Level, Row[]>>({ woj: [], pow: [] });
  const [geos, setGeos] = useState<Record<Level, any>>({ woj: null, pow: null });
  const [metric, setMetric] = useState<Metric>('indeks_gotowosci');
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    fetch('./data/regiony.json').then((r) => r.json()).then((d) => setData((s) => ({ ...s, woj: d.regiony.map((r: any) => ({ ...r, key: r.wojewodztwo, name: r.wojewodztwo, sub: '' })) })));
    fetch('./data/wojewodztwa.geojson').then((r) => r.json()).then((g) => setGeos((s) => ({ ...s, woj: g })));
  }, []);
  useEffect(() => {
    if (level !== 'pow' || data.pow.length) return;
    fetch('./data/powiaty.json').then((r) => r.json()).then((d) => setData((s) => ({ ...s, pow: d.powiaty.map((r: any) => ({ ...r, key: r.id, name: r.powiat.replace(/^powiat /, ''), sub: r.wojewodztwo })) })));
    fetch('./data/powiaty.geojson').then((r) => r.json()).then((g) => setGeos((s) => ({ ...s, pow: g })));
  }, [level]);

  const metrics = METRICS.filter((x) => x.levels.includes(level));
  const m = metrics.find((x) => x.key === metric) || metrics[0];
  const rows = data[level];
  const geo = geos[level];
  const val = (r: Row) => (r[m.key] as number) ?? 0;
  const byKey = useMemo(() => Object.fromEntries(rows.map((r) => [r.key, r])), [rows]);
  const [min, max] = useMemo(() => { const v = rows.map(val); return v.length ? [Math.min(...v), Math.max(...v)] : [0, 0]; }, [rows, m.key]);
  const colorFor = (v: number) => RAMP[Math.min(RAMP.length - 1, Math.floor(((v - min) / (max - min || 1)) * RAMP.length))];
  const featKey = (f: any) => (level === 'woj' ? String(f.properties.nazwa).toLowerCase() : String(f.properties.id));

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false, dragging: !L.Browser.mobile }).setView([52.0, 19.3], 6);
    map.attributionControl.addAttribution('Granice: PRG (GUGiK) via polska-geojson');
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geo || !rows.length) return;
    layerRef.current?.remove();
    const w = level === 'woj' ? 2 : 0.6;
    const layer = L.geoJSON(geo, {
      style: (f) => {
        const r = byKey[featKey(f)];
        return { fillColor: r ? colorFor(val(r)) : '#ccc', fillOpacity: 1, color: '#ffffff', weight: w };
      },
      onEachFeature: (f, l) => {
        const r = byKey[featKey(f)];
        if (!r) return;
        l.bindTooltip(`<b>${r.name}</b>${r.sub ? `<br>${r.sub}` : ''}<br>${m.label}: <b>${val(r)}${m.unit}</b><br>AED: ${r.aed.toLocaleString('pl-PL')}`, { sticky: true });
        l.on('mouseover', () => (l as L.Path).setStyle({ weight: 3, color: '#0B2A3C' }));
        l.on('mouseout', () => (l as L.Path).setStyle({ weight: w, color: '#ffffff' }));
      },
    }).addTo(map);
    map.fitBounds(layer.getBounds(), { padding: [8, 8] });
    layerRef.current = layer;
  }, [geo, rows, m.key, level]);

  const sorted = useMemo(() => [...rows].sort((a, b) => val(b) - val(a) || b.aed - a.aed), [rows, m.key]);
  const needle = q.trim().toLowerCase();
  const shown = sorted.map((r, i) => ({ r, rank: i + 1 })).filter(({ r }) => !needle || `${r.name} ${r.sub}`.toLowerCase().includes(needle));
  const visible = all || needle ? shown : shown.slice(0, PAGE);
  const total = rows.reduce((s, r) => s + r.aed, 0);
  const fromDisp = rows.reduce((s, r) => s + Math.round((r.aed * r.od_dysponentow_pct) / 100), 0);
  const unitsWithDisp = rows.filter((r) => r.od_dysponentow_pct > 0).length;

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Mapa luk w danych</p>
        <h1>Gdzie brakuje danych o AED?</h1>
        <p className="lead">AED są na mapach społecznościowych, ale prawie nikt nie publikuje danych o ich sprawności i dostępności. Zobacz, gdzie akcja AEDostępni jest najbardziej potrzebna.</p>
      </header>

      {rows.length > 0 && (
        <section className="kpis" aria-label="Podsumowanie">
          <div className="kpi"><b>{total.toLocaleString('pl-PL')}</b><span>AED przypisanych do {level === 'woj' ? 'województw' : 'powiatów'}</span></div>
          <div className="kpi kpi-bad"><b>{fromDisp}</b><span>potwierdzonych w danych dysponentów ({Math.round((fromDisp / (total || 1)) * 1000) / 10}%)</span></div>
          <div className="kpi kpi-bad"><b>{unitsWithDisp} z {rows.length}</b><span>{level === 'woj' ? 'województw' : 'powiatów'} ma choć jeden zbiór dysponenta</span></div>
        </section>
      )}

      <section className="card">
        <div className="level-row">
          <div className="segmented" role="radiogroup" aria-label="Poziom">
            <button role="radio" aria-checked={level === 'woj'} className={level === 'woj' ? 'on' : ''} onClick={() => { setLevel('woj'); setAll(false); setQ(''); }}>Województwa</button>
            <button role="radio" aria-checked={level === 'pow'} className={level === 'pow' ? 'on' : ''} onClick={() => { setLevel('pow'); setAll(false); setQ(''); }}>Powiaty (380)</button>
          </div>
        </div>
        <div className="metric-tabs" role="radiogroup" aria-label="Wskaźnik na mapie">
          {metrics.map((x) => (
            <button key={x.key} role="radio" aria-checked={m.key === x.key} className={m.key === x.key ? 'on' : ''} onClick={() => setMetric(x.key)}>{x.label}</button>
          ))}
        </div>
        <p className="muted small">{m.help}</p>
        <div className="grid-map">
          <div ref={mapEl} className="choropleth" role="region" aria-label={`Kartogram (${level === 'woj' ? 'województwa' : 'powiaty'}): ${m.label}. Te same dane w tabeli obok.`} />
          <div>
            <div className="legend" aria-hidden="true">
              <span>{min}{m.unit}</span>
              <span className="legend-ramp">{RAMP.map((c) => <i key={c} style={{ background: c }} />)}</span>
              <span>{max}{m.unit}</span>
            </div>
            {level === 'pow' && (
              <label className="field" style={{ marginBottom: 10 }}>
                <span className="sr-only">Szukaj powiatu</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj powiatu lub województwa, np. bydgoski" />
              </label>
            )}
            {rows.length === 0 && <p role="status" className="muted">Wczytywanie…</p>}
            <div className="table-wrap">
              <table className="table table-sm">
                <caption className="sr-only">Ranking: {m.label}</caption>
                <thead><tr><th scope="col">#</th><th scope="col">{level === 'woj' ? 'Województwo' : 'Powiat'}</th><th scope="col">{m.label}</th><th scope="col">AED</th></tr></thead>
                <tbody>
                  {visible.map(({ r, rank }) => (
                    <tr key={r.key}>
                      <td>{rank}</td>
                      <th scope="row"><span className="swatch" style={{ background: colorFor(val(r)) }} aria-hidden="true" />{r.name}{r.sub && <small className="muted"> · {r.sub}</small>}</th>
                      <td><b>{val(r)}{m.unit}</b></td>
                      <td>{r.aed.toLocaleString('pl-PL')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!all && !needle && shown.length > PAGE && <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => setAll(true)}>Pokaż wszystkie ({shown.length})</button>}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Jak poprawić wynik swojego regionu?</h2>
        <ol className="howto">
          <li><b>Gminy i powiaty:</b> zbierzcie dane o AED w swoich jednostkach (szkoły, urzędy, OSP, pływalnie) i opublikujcie je w dane.gov.pl za pomocą <a href="#/dysponenci">walidatora AEDostępni</a>.</li>
          <li><b>Szpitale, uczelnie, przewoźnicy, galerie:</b> to oni mają najwięcej AED. Jeden plik CSV wystarczy, żeby AED trafiły do krajowej mapy.</li>
          <li><b>Wojewodowie i urzędy marszałkowskie:</b> mogą zebrać dane z regionu w jednym zbiorze, bo standard jest wspólny.</li>
        </ol>
        <p className="muted small">Wskaźniki liczone automatycznie przy każdej aktualizacji danych. Ludność: GUS, stan na 31.12.2023 (zaokrąglone). Pobierz: <a href="./data/regiony.json" download>regiony.json</a>, <a href="./data/powiaty.json" download>powiaty.json</a>.</p>
      </section>
    </div>
  );
}
