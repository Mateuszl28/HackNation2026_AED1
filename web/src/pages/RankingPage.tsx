import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';

interface R {
  wojewodztwo: string; terc: string; aed: number; na_100_tys: number; z_godzinami_pct: number; z_opisem_pct: number;
  z_kontrola_pct: number; od_dysponentow_pct: number; zbiory_dysponentow: number; srednia_jakosc: number; indeks_gotowosci: number;
}
type Metric = 'indeks_gotowosci' | 'na_100_tys' | 'z_godzinami_pct' | 'z_kontrola_pct' | 'od_dysponentow_pct';
const METRICS: { key: Metric; label: string; unit: string; help: string }[] = [
  { key: 'indeks_gotowosci', label: 'Indeks gotowości danych', unit: '/100', help: '30% godziny dostępności + 30% opis miejsca + 20% data kontroli + 20% dane od dysponenta' },
  { key: 'na_100_tys', label: 'AED na 100 tys. mieszkańców', unit: '', help: 'Liczba znanych AED w przeliczeniu na ludność (GUS 2023)' },
  { key: 'z_godzinami_pct', label: 'AED z godzinami dostępności', unit: '%', help: 'Czy ratujący wie, że AED jest dostępny TERAZ' },
  { key: 'z_kontrola_pct', label: 'AED z datą kontroli', unit: '%', help: 'Czy wiadomo, że urządzenie jest sprawne' },
  { key: 'od_dysponentow_pct', label: 'AED z danych dysponentów', unit: '%', help: 'Udział AED potwierdzonych w zbiorach dysponentów na dane.gov.pl' },
];
// Sekwencyjna skala w jednym odcieniu (zieleń marki), jasna → ciemna
const RAMP = ['#CFE8D8', '#A6D6B9', '#7FC49C', '#3FA06B', '#007A3D', '#00522A'];

export default function RankingPage() {
  const [rows, setRows] = useState<R[]>([]);
  const [geo, setGeo] = useState<any>(null);
  const [metric, setMetric] = useState<Metric>('indeks_gotowosci');
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    fetch('./data/regiony.json').then((r) => r.json()).then((d) => setRows(d.regiony));
    fetch('./data/wojewodztwa.geojson').then((r) => r.json()).then(setGeo);
  }, []);

  const m = METRICS.find((x) => x.key === metric)!;
  const byName = useMemo(() => Object.fromEntries(rows.map((r) => [r.wojewodztwo, r])), [rows]);
  const [min, max] = useMemo(() => { const v = rows.map((r) => r[metric]); return [Math.min(...v), Math.max(...v)]; }, [rows, metric]);
  const colorFor = (v: number) => RAMP[Math.min(RAMP.length - 1, Math.floor(((v - min) / (max - min || 1)) * RAMP.length))];

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
    const layer = L.geoJSON(geo, {
      style: (f) => {
        const r = byName[String(f?.properties.nazwa).toLowerCase()];
        return { fillColor: r ? colorFor(r[metric]) : '#ccc', fillOpacity: 1, color: '#ffffff', weight: 2 };
      },
      onEachFeature: (f, l) => {
        const r = byName[String(f.properties.nazwa).toLowerCase()];
        if (!r) return;
        l.bindTooltip(`<b>${r.wojewodztwo}</b><br>${m.label}: <b>${r[metric]}${m.unit}</b><br>AED: ${r.aed.toLocaleString('pl-PL')}`, { sticky: true });
        l.on('mouseover', () => (l as L.Path).setStyle({ weight: 3, color: '#0B2A3C' }));
        l.on('mouseout', () => (l as L.Path).setStyle({ weight: 2, color: '#ffffff' }));
      },
    }).addTo(map);
    map.fitBounds(layer.getBounds(), { padding: [8, 8] });
    layerRef.current = layer;
  }, [geo, rows, metric]);

  const sorted = [...rows].sort((a, b) => b[metric] - a[metric]);
  const total = rows.reduce((s, r) => s + r.aed, 0);
  const fromDisp = rows.reduce((s, r) => s + Math.round((r.aed * r.od_dysponentow_pct) / 100), 0);

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Mapa luk w danych</p>
        <h1>Gdzie brakuje danych o AED?</h1>
        <p className="lead">AED są na mapach społecznościowych, ale prawie nikt nie publikuje danych o ich sprawności i dostępności. Zobacz, gdzie akcja AEDostępni jest najbardziej potrzebna.</p>
      </header>

      {rows.length > 0 && (
        <section className="kpis kpis-lg" aria-label="Podsumowanie">
          <div className="kpi"><b>{total.toLocaleString('pl-PL')}</b><span>AED przypisanych do województw</span></div>
          <div className="kpi kpi-bad"><b>{fromDisp}</b><span>potwierdzonych w danych dysponentów ({Math.round((fromDisp / total) * 1000) / 10}%)</span></div>
          <div className="kpi"><b>{sorted[0]?.wojewodztwo}</b><span>lider: {m.label.toLowerCase()}</span></div>
        </section>
      )}

      <section className="card">
        <div className="metric-tabs" role="radiogroup" aria-label="Wskaźnik na mapie">
          {METRICS.map((x) => (
            <button key={x.key} role="radio" aria-checked={metric === x.key} className={metric === x.key ? 'on' : ''} onClick={() => setMetric(x.key)}>{x.label}</button>
          ))}
        </div>
        <p className="muted small">{m.help}</p>
        <div className="grid-map">
          <div ref={mapEl} className="choropleth" role="img" aria-label={`Kartogram województw: ${m.label}. Te same dane w tabeli obok.`} />
          <div>
            <div className="legend" aria-hidden="true">
              <span>{min}{m.unit}</span>
              <span className="legend-ramp">{RAMP.map((c) => <i key={c} style={{ background: c }} />)}</span>
              <span>{max}{m.unit}</span>
            </div>
            <div className="table-wrap">
              <table className="table table-sm">
                <caption className="sr-only">Ranking województw: {m.label}</caption>
                <thead><tr><th scope="col">#</th><th scope="col">Województwo</th><th scope="col">{m.label}</th><th scope="col">AED</th></tr></thead>
                <tbody>
                  {sorted.map((r, i) => (
                    <tr key={r.terc}>
                      <td>{i + 1}</td>
                      <th scope="row"><span className="swatch" style={{ background: colorFor(r[metric]) }} aria-hidden="true" />{r.wojewodztwo}</th>
                      <td><b>{r[metric]}{m.unit}</b></td>
                      <td>{r.aed.toLocaleString('pl-PL')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
        <p className="muted small">Wskaźniki liczone automatycznie przy każdej aktualizacji danych. Ludność: GUS, stan na 31.12.2023 (zaokrąglone). Pobierz: <a href="./data/regiony.json" download>regiony.json</a>.</p>
      </section>
    </div>
  );
}
