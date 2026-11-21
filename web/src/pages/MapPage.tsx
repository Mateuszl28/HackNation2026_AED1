import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet.markercluster';
import { describeHours } from '@shared/hours.ts';
import {
  loadAeds, availability, distanceM, walkMinutes, fmtDist, address, is247, sourceList,
  ACCESS_LABEL, SECURITY_LABEL, BYDGOSZCZ,
} from '../data';
import type { Aed, Availability } from '../data';

const AV_LABEL: Record<Availability, string> = { open: 'Dostępny teraz', closed: 'Teraz niedostępny', unknown: 'Godziny nieznane' };
const CITIES: { name: string; c: [number, number]; z: number }[] = [
  { name: 'Bydgoszcz', c: BYDGOSZCZ, z: 13 }, { name: 'Warszawa', c: [52.2297, 21.0122], z: 13 },
  { name: 'Kraków', c: [50.0614, 19.9366], z: 13 }, { name: 'Gdańsk', c: [54.352, 18.6466], z: 13 },
  { name: 'Przemyśl', c: [49.7838, 22.7678], z: 14 }, { name: 'Polska', c: [52.0, 19.3], z: 6 },
];

function markerIcon(av: Availability, selected = false) {
  const glyph = av === 'open' ? '✓' : av === 'closed' ? '✕' : '?';
  return L.divIcon({
    className: '',
    html: `<div class="pin pin-${av}${selected ? ' pin-selected' : ''}" aria-hidden="true"><span>${glyph}</span></div>`,
    iconSize: [30, 38], iconAnchor: [15, 37],
  });
}

export default function MapPage() {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const meRef = useRef<L.CircleMarker | null>(null);
  const [aeds, setAeds] = useState<Aed[]>([]);
  const [me, setMe] = useState<[number, number] | null>(null);
  const [center, setCenter] = useState<[number, number]>(BYDGOSZCZ);
  const [sel, setSel] = useState<Aed | null>(null);
  const [geoMsg, setGeoMsg] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [only247, setOnly247] = useState(false);
  const [onlyPublic, setOnlyPublic] = useState(false);
  const [sheet, setSheet] = useState(true);
  const now = useMemo(() => new Date(), [aeds]);

  useEffect(() => { loadAeds().then(setAeds); }, []);

  const filtered = useMemo(() => aeds.filter((a) =>
    (!onlyOpen || availability(a, now) === 'open') && (!only247 || is247(a.godziny_dostepnosci)) && (!onlyPublic || a.dostep === 'publiczny')),
  [aeds, onlyOpen, only247, onlyPublic, now]);

  // inicjalizacja mapy
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { zoomControl: false, preferCanvas: true }).setView(BYDGOSZCZ, 13);
    L.control.zoom({ position: 'bottomright', zoomInTitle: 'Przybliż', zoomOutTitle: 'Oddal' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">współtwórcy OpenStreetMap</a>',
    }).addTo(map);
    map.on('moveend', () => { const c = map.getCenter(); setCenter([c.lat, c.lng]); });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // markery
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    clusterRef.current?.remove();
    const cluster = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 45, showCoverageOnHover: false });
    const markers = filtered.map((a) => {
      const m = L.marker([a.lat, a.lon], { icon: markerIcon(availability(a, now)), title: a.nazwa, alt: `${a.nazwa} — ${AV_LABEL[availability(a, now)]}`, keyboard: true });
      m.on('click', () => { setSel(a); setSheet(true); });
      return m;
    });
    cluster.addLayers(markers);
    cluster.addTo(map);
    clusterRef.current = cluster;
  }, [filtered, now]);

  // zaznaczenie
  const selMarker = useRef<L.Marker | null>(null);
  useEffect(() => {
    selMarker.current?.remove();
    if (sel && mapRef.current) {
      selMarker.current = L.marker([sel.lat, sel.lon], { icon: markerIcon(availability(sel, now), true), zIndexOffset: 1000, interactive: false }).addTo(mapRef.current);
    }
  }, [sel, now]);

  const ref = me ?? center;
  const nearest = useMemo(() => filtered
    .map((a) => ({ a, d: distanceM(ref[0], ref[1], a.lat, a.lon) }))
    .sort((x, y) => x.d - y.d).slice(0, 6), [filtered, ref[0], ref[1]]);

  function locate() {
    setGeoMsg('Ustalam Twoją lokalizację…');
    if (!navigator.geolocation) { setGeoMsg('Twoje urządzenie nie udostępnia lokalizacji.'); return; }
    navigator.geolocation.getCurrentPosition((p) => {
      const pos: [number, number] = [p.coords.latitude, p.coords.longitude];
      setMe(pos); setGeoMsg('');
      const map = mapRef.current!;
      meRef.current?.remove();
      meRef.current = L.circleMarker(pos, { radius: 9, color: '#fff', weight: 3, fillColor: '#1565c0', fillOpacity: 1 }).addTo(map).bindTooltip('Tu jesteś');
      const n = filtered.map((a) => ({ a, d: distanceM(pos[0], pos[1], a.lat, a.lon) })).sort((x, y) => x.d - y.d)[0];
      if (n) { setSel(n.a); map.fitBounds(L.latLngBounds([pos, [n.a.lat, n.a.lon]]).pad(0.4)); } else map.setView(pos, 16);
      setSheet(true);
    }, (e) => setGeoMsg(e.code === 1 ? 'Brak zgody na lokalizację. Przesuń mapę ręcznie albo wybierz miasto.' : 'Nie udało się ustalić lokalizacji.'),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  }

  function focus(a: Aed) {
    setSel(a);
    mapRef.current?.setView([a.lat, a.lon], Math.max(mapRef.current.getZoom(), 17));
  }

  return (
    <div className="map-layout">
      <div ref={mapEl} className="map" role="application" aria-label="Mapa defibrylatorów AED. Lista najbliższych AED znajduje się w panelu obok mapy." />

      <div className="map-toolbar">
        <button className="btn btn-primary btn-lg" onClick={locate}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9 3h-2.1A7 7 0 0 0 13 5.1V3h-2v2.1A7 7 0 0 0 5.1 11H3v2h2.1a7 7 0 0 0 5.9 5.9V21h2v-2.1a7 7 0 0 0 5.9-5.9H21v-2zm-9 6a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" /></svg>
          Znajdź najbliższy AED
        </button>
        <div className="chips" role="group" aria-label="Filtry">
          <label className="chip"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> Dostępne teraz</label>
          <label className="chip"><input type="checkbox" checked={only247} onChange={(e) => setOnly247(e.target.checked)} /> 24/7</label>
          <label className="chip"><input type="checkbox" checked={onlyPublic} onChange={(e) => setOnlyPublic(e.target.checked)} /> Publiczne</label>
          <label className="chip chip-select">
            <span className="sr-only">Przejdź do miasta</span>
            <select defaultValue="" onChange={(e) => { const c = CITIES.find((x) => x.name === e.target.value); if (c) mapRef.current?.setView(c.c, c.z); }}>
              <option value="" disabled>Miasto…</option>
              {CITIES.map((c) => <option key={c.name}>{c.name}</option>)}
            </select>
          </label>
        </div>
        {geoMsg && <p className="geo-msg" role="status">{geoMsg}</p>}
      </div>

      <section className={`sheet ${sheet ? 'open' : ''}`} aria-label="Panel informacji o AED">
        <button className="sheet-handle" onClick={() => setSheet(!sheet)} aria-expanded={sheet}>
          <span className="sr-only">{sheet ? 'Zwiń panel' : 'Rozwiń panel'}</span>
        </button>
        {sel ? <Details a={sel} me={me} now={now} onClose={() => setSel(null)} /> : (
          <div className="sheet-body">
            <div className="emergency-tip">
              <strong>Ktoś stracił przytomność i nie oddycha?</strong>
              <ol>
                <li>Zadzwoń <a href="tel:112">112</a> i włącz głośnik.</li>
                <li>Uciskaj klatkę piersiową: mocno, 100–120/min.</li>
                <li>Wyślij kogoś po najbliższy AED — poniżej.</li>
              </ol>
            </div>
            <h2 className="h-sm">{me ? 'Najbliżej Ciebie' : 'Najbliżej środka mapy'} <span className="muted">({filtered.length.toLocaleString('pl-PL')} AED na mapie)</span></h2>
            {aeds.length === 0 && <p role="status">Wczytywanie danych…</p>}
            <ul className="near-list">
              {nearest.map(({ a, d }) => {
                const av = availability(a, now);
                return (
                  <li key={a.aed_uid}>
                    <button onClick={() => focus(a)} className="near-item">
                      <span className={`dot dot-${av}`} aria-hidden="true" />
                      <span className="near-main">
                        <span className="near-name">{a.nazwa}</span>
                        <span className="near-sub">{a.opis_lokalizacji || address(a)}</span>
                        <span className={`badge badge-${av}`}>{AV_LABEL[av]}</span>
                      </span>
                      <span className="near-dist"><b>{fmtDist(d)}</b><small>tam i z powrotem ~{walkMinutes(d) * 2} min</small></span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function Details({ a, me, now, onClose }: { a: Aed; me: [number, number] | null; now: Date; onClose: () => void }) {
  const av = availability(a, now);
  const d = me ? distanceM(me[0], me[1], a.lat, a.lon) : null;
  const nav = `https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lon}&travelmode=walking`;
  const q = Number(a.jakosc);
  return (
    <div className="sheet-body details">
      <div className="details-head">
        <div>
          <span className={`badge badge-${av}`}>{AV_LABEL[av]}</span>
          <h2>{a.nazwa}</h2>
          <p className="muted">{address(a)}</p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Zamknij szczegóły i wróć do listy najbliższych">✕</button>
      </div>
      {d !== null && <p className="dist-line"><b>{fmtDist(d)}</b> · szybkim marszem ~{walkMinutes(d)} min w jedną stronę</p>}
      <div className="actions">
        <a className="btn btn-primary" href={nav} target="_blank" rel="noopener">Prowadź pieszo</a>
        {a.telefon_kontaktowy && <a className="btn" href={`tel:${a.telefon_kontaktowy.replace(/\s/g, '')}`}>Zadzwoń do obiektu</a>}
      </div>
      <dl className="facts">
        <dt>Gdzie dokładnie</dt><dd>{a.opis_lokalizacji || <span className="missing">brak opisu — pomóż uzupełnić</span>}{a.kondygnacja && ` (kondygnacja ${a.kondygnacja})`}</dd>
        <dt>Godziny</dt><dd>{describeHours(a.godziny_dostepnosci)}</dd>
        <dt>Dostęp</dt><dd>{ACCESS_LABEL[a.dostep] || a.dostep}</dd>
        <dt>Zabezpieczenie</dt><dd>{SECURITY_LABEL[a.zabezpieczenie] || a.zabezpieczenie}</dd>
        {a.instrukcja_dostepu && <><dt>Jak otworzyć</dt><dd>{a.instrukcja_dostepu}</dd></>}
        <dt>Dysponent</dt><dd>{a.dysponent || <span className="missing">nieznany</span>}</dd>
        <dt>Ostatnia kontrola</dt><dd>{a.data_ostatniej_kontroli || <span className="missing">brak danych</span>}</dd>
        <dt>Jakość danych</dt><dd><meter min={0} max={100} low={50} high={75} optimum={100} value={q} aria-label={`Jakość danych ${q} na 100`} /> {q}/100</dd>
        <dt>Źródła</dt>
        <dd><ul className="src-list">{sourceList(a).map((s) => <li key={s.id + s.ref}><a href={s.url} target="_blank" rel="noopener">{s.name}</a></li>)}</ul></dd>
      </dl>
      {a.zdjecie_url && <img className="aed-photo" src={a.zdjecie_url} alt={`Zdjęcie miejsca zawieszenia AED: ${a.nazwa}`} loading="lazy" />}
      <Link className="btn btn-ghost" to={`/zglos?aed=${encodeURIComponent(a.aed_uid)}`}>Zgłoś problem lub popraw dane</Link>
    </div>
  );
}
