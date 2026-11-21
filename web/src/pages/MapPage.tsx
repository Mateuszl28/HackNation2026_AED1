import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { aedLink } from '../config';
import L from 'leaflet';
import 'leaflet.markercluster';
import { describeHours } from '@shared/hours.ts';
import {
  loadAeds, availability, distanceM, walkMinutes, fmtDist, address, is247, sourceList, displayName, subLine,
  ACCESS_LABEL, SECURITY_LABEL, BYDGOSZCZ,
} from '../data';
import type { Aed, Availability } from '../data';

const AV_LABEL: Record<Availability, string> = { open: 'Dostępny teraz', closed: 'Teraz niedostępny', unknown: 'Godziny nieznane' };
const AV_GLYPH: Record<Availability, string> = { open: '✓', closed: '✕', unknown: '?' };
const CITIES: { name: string; c: [number, number]; z: number }[] = [
  { name: 'Bydgoszcz', c: BYDGOSZCZ, z: 13 }, { name: 'Warszawa', c: [52.2297, 21.0122], z: 13 },
  { name: 'Kraków', c: [50.0614, 19.9366], z: 13 }, { name: 'Gdańsk', c: [54.352, 18.6466], z: 13 },
  { name: 'Wrocław', c: [51.1079, 17.0385], z: 13 }, { name: 'Poznań', c: [52.4064, 16.9252], z: 13 },
  { name: 'Przemyśl', c: [49.7838, 22.7678], z: 14 }, { name: 'Cała Polska', c: [52.0, 19.3], z: 6 },
];

function markerIcon(av: Availability, selected = false) {
  return L.divIcon({
    className: '',
    html: `<div class="pin pin-${av}${selected ? ' pin-selected' : ''}" aria-hidden="true"><span>${AV_GLYPH[av]}</span></div>`,
    iconSize: [30, 38], iconAnchor: [15, 37],
  });
}

const IconLocate = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9 3h-2.1A7 7 0 0 0 13 5.1V3h-2v2.1A7 7 0 0 0 5.1 11H3v2h2.1a7 7 0 0 0 5.9 5.9V21h2v-2.1a7 7 0 0 0 5.9-5.9H21v-2zm-9 6a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" /></svg>
);
const IconHeart = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z" /><path d="M6 11h3l1.5-3 2.5 6 1.5-3H18" fill="none" stroke="#d7262e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

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
  const [sheet, setSheet] = useState(false);
  const now = useMemo(() => new Date(), [aeds]);

  useEffect(() => { loadAeds().then(setAeds); }, []);

  // Link bezpośredni: #/aed/<aed_uid> albo #/aed/@lat,lon (np. z kodu QR na naklejce)
  const { uid } = useParams();
  useEffect(() => {
    if (!uid || !aeds.length || !mapRef.current) return;
    let target: Aed | undefined;
    const at = uid.match(/^@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
    if (at) {
      const [lat, lon] = [Number(at[1]), Number(at[2])];
      const best = aeds.map((a) => ({ a, d: distanceM(lat, lon, a.lat, a.lon) })).sort((x, y) => x.d - y.d)[0];
      if (best && best.d < 60) target = best.a;
      else { mapRef.current.setView([lat, lon], 18); setGeoMsg('Tego AED nie ma jeszcze w zbiorze krajowym — pokazujemy wskazane miejsce.'); }
    } else target = aeds.find((a) => a.aed_uid === uid);
    if (target) { setSel(target); setSheet(true); mapRef.current.setView([target.lat, target.lon], 18); }
  }, [uid, aeds]);

  const filtered = useMemo(() => aeds.filter((a) =>
    (!onlyOpen || availability(a, now) === 'open') && (!only247 || is247(a.godziny_dostepnosci)) && (!onlyPublic || a.dostep === 'publiczny')),
  [aeds, onlyOpen, only247, onlyPublic, now]);

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    clusterRef.current?.remove();
    const cluster = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 45, showCoverageOnHover: false });
    cluster.addLayers(filtered.map((a) => {
      const av = availability(a, now);
      const m = L.marker([a.lat, a.lon], { icon: markerIcon(av), title: displayName(a), alt: `${displayName(a)} — ${AV_LABEL[av]}`, keyboard: true });
      m.on('click', () => { setSel(a); setSheet(true); });
      return m;
    }));
    cluster.addTo(map);
    clusterRef.current = cluster;
  }, [filtered, now]);

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
    .sort((x, y) => x.d - y.d).slice(0, 8), [filtered, ref[0], ref[1]]);

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
      if (n) { setSel(n.a); map.fitBounds(L.latLngBounds([pos, [n.a.lat, n.a.lon]]).pad(0.5)); } else map.setView(pos, 16);
      setSheet(true);
    }, (e) => setGeoMsg(e.code === 1 ? 'Brak zgody na lokalizację. Przesuń mapę albo wybierz miasto.' : 'Nie udało się ustalić lokalizacji.'),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  }

  function focus(a: Aed) {
    setSel(a); setSheet(true);
    mapRef.current?.setView([a.lat, a.lon], Math.max(mapRef.current.getZoom(), 17));
  }

  return (
    <div className="map-layout">
      <div ref={mapEl} className="map" role="application" aria-label="Mapa defibrylatorów AED. Lista najbliższych AED znajduje się w panelu." />

      <div className="map-toolbar">
        <div className="toolbar-row">
          <button className="btn btn-primary btn-lg" onClick={locate}><IconLocate /> Najbliższy AED</button>
          <Link className="btn btn-lg btn-rescue" to="/ratunek" aria-label="Tryb ratunkowy: najbliższy dostępny AED i metronom RKO">SOS</Link>
        </div>
        <div className="chips" role="group" aria-label="Filtry mapy">
          <label className="chip"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> Dostępne teraz</label>
          <label className="chip"><input type="checkbox" checked={only247} onChange={(e) => setOnly247(e.target.checked)} /> 24/7</label>
          <label className="chip"><input type="checkbox" checked={onlyPublic} onChange={(e) => setOnlyPublic(e.target.checked)} /> Publiczne</label>
          <label className="chip">
            <span className="sr-only">Przejdź do miasta</span>
            <select defaultValue="" onChange={(e) => { const c = CITIES.find((x) => x.name === e.target.value); if (c) mapRef.current?.setView(c.c, c.z); }}>
              <option value="" disabled>Miasto ▾</option>
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
            <Link className="sos" to="/ratunek">
              <span className="sos-icon"><IconHeart /></span>
              <span><b>Ktoś nie oddycha?</b><small>Tryb ratunkowy: 112, najbliższy AED, metronom RKO</small></span>
              <span className="chev" aria-hidden="true">›</span>
            </Link>
            <div className="sheet-title">
              <h2>{me ? 'Najbliżej Ciebie' : 'Najbliżej środka mapy'}</h2>
              <span>{filtered.length.toLocaleString('pl-PL')} AED na mapie</span>
            </div>
            {aeds.length === 0 && <p role="status" className="muted">Wczytywanie danych…</p>}
            <ul className="near-list">
              {nearest.map(({ a, d }) => {
                const av = availability(a, now);
                return (
                  <li key={a.aed_uid}>
                    <button onClick={() => focus(a)} className="near-item" aria-label={`${displayName(a)}, ${fmtDist(d)}, ${AV_LABEL[av]}`}>
                      <span className={`near-ico ${av}`} aria-hidden="true">{AV_GLYPH[av]}</span>
                      <span className="near-main">
                        <span className="near-name">{displayName(a)}</span>
                        <span className="near-sub">{subLine(a)}</span>
                        <span className={`badge badge-${av}`}>{AV_LABEL[av]}</span>
                      </span>
                      <span className="near-dist"><b>{fmtDist(d)}</b><small>⇄ ~{walkMinutes(d) * 2} min</small></span>
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
  const [shared, setShared] = useState('');
  useEffect(() => setShared(''), [a.aed_uid]);
  async function share(x: Aed) {
    const url = aedLink(x.aed_uid);
    const text = `AED: ${displayName(x)}${x.opis_lokalizacji ? ` — ${x.opis_lokalizacji}` : ''}`;
    try {
      if (navigator.share) await navigator.share({ title: 'AEDostępni', text, url });
      else { await navigator.clipboard.writeText(`${text}\n${url}`); setShared('Skopiowano link ✓'); }
    } catch { /* anulowano */ }
  }
  return (
    <div className="sheet-body details">
      <div className="details-head">
        <div>
          <span className={`badge badge-${av}`}>{AV_GLYPH[av]} {AV_LABEL[av]}</span>
          <h2>{displayName(a)}</h2>
          <p className="muted">{address(a)}</p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Zamknij szczegóły i wróć do listy najbliższych">✕</button>
      </div>
      {d !== null && <p className="dist-line"><b>{fmtDist(d)}</b> · szybkim marszem ~{walkMinutes(d)} min w jedną stronę</p>}
      <div className="actions">
        <a className="btn btn-primary" href={nav} target="_blank" rel="noopener">Prowadź pieszo</a>
        {a.telefon_kontaktowy && <a className="btn" href={`tel:${a.telefon_kontaktowy.replace(/\s/g, '')}`}>Zadzwoń</a>}
        <button className="btn" onClick={() => share(a)}>{shared || 'Udostępnij'}</button>
      </div>
      <div className="where-box">
        <span className="label">Gdzie dokładnie</span>
        <p>{a.opis_lokalizacji || <span className="missing">brak opisu — pomóż uzupełnić</span>}{a.kondygnacja && ` · kondygnacja ${a.kondygnacja}`}</p>
      </div>
      <dl className="facts">
        <dt>Godziny</dt><dd>{describeHours(a.godziny_dostepnosci)}</dd>
        <dt>Dostęp</dt><dd>{ACCESS_LABEL[a.dostep] || a.dostep}</dd>
        <dt>Zabezpieczenie</dt><dd>{SECURITY_LABEL[a.zabezpieczenie] || a.zabezpieczenie}</dd>
        {a.instrukcja_dostepu && <><dt>Jak otworzyć</dt><dd>{a.instrukcja_dostepu}</dd></>}
        <dt>Dysponent</dt><dd>{a.dysponent || <span className="missing">nieznany</span>}</dd>
        <dt>Kontrola</dt><dd>{a.data_ostatniej_kontroli || <span className="missing">brak danych</span>}</dd>
        <dt>Jakość danych</dt><dd><meter min={0} max={100} low={50} high={75} optimum={100} value={q} aria-label={`Jakość danych ${q} na 100`} /> {q}/100</dd>
        <dt>Źródła</dt>
        <dd><ul className="src-list">{sourceList(a).map((s) => <li key={s.id + s.ref}><a href={s.url} target="_blank" rel="noopener">{s.name}</a></li>)}</ul></dd>
      </dl>
      {a.zdjecie_url && <img className="aed-photo" src={a.zdjecie_url} alt={`Zdjęcie miejsca zawieszenia AED: ${displayName(a)}`} loading="lazy" />}
      <Link className="btn btn-ghost" style={{ width: '100%' }} to={`/zglos?aed=${encodeURIComponent(a.aed_uid)}`}>Zgłoś problem lub popraw dane</Link>
    </div>
  );
}
