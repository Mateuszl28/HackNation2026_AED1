import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BACK_EVENT } from '../native';
import { aedLink } from '../config';
import { shareText } from '../share';
import L from 'leaflet';
import 'leaflet.markercluster';
import { describeHours } from '@shared/hours.ts';
import {
  loadAeds, availability, distanceM, walkMinutes, fmtDist, address, is247, sourceList, displayName, subLine, shortAddress,
  ACCESS_LABEL, SECURITY_LABEL, BYDGOSZCZ,
} from '../data';
import type { Aed, Availability } from '../data';

const AV_LABEL: Record<Availability, string> = { open: 'Dostępny teraz', closed: 'Teraz niedostępny', unknown: 'Godziny nieznane' };
const AV_GLYPH: Record<Availability, string> = { open: '✓', closed: '✕', unknown: '?' };
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
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
  const accRef = useRef<L.Circle | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [tilesDown, setTilesDown] = useState(false);
  const [aeds, setAeds] = useState<Aed[]>([]);
  const [me, setMe] = useState<[number, number] | null>(null);
  const [center, setCenter] = useState<[number, number]>(BYDGOSZCZ);
  const [sel, setSel] = useState<Aed | null>(null);
  const [geoMsg, setGeoMsg] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [only247, setOnly247] = useState(false);
  const [onlyPublic, setOnlyPublic] = useState(false);
  const [sheet, setSheet] = useState<'peek' | 'mid' | 'full'>('peek');
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
    if (target) { setSel(target); setSheet('mid'); showOnMap([[target.lat, target.lon]]); }
  }, [uid, aeds]);

  // Skrót „Najbliższy AED” z ikony aplikacji (#/?locate=1): od razu ustalamy lokalizację
  const [search, setSearch] = useSearchParams();
  useEffect(() => {
    if (search.get('locate') !== '1' || !aeds.length || !mapRef.current) return;
    setSearch({}, { replace: true });
    locate();
  }, [search, aeds]);

  // Przycisk „wstecz” na Androidzie: najpierw zamyka kartę AED / zwija panel
  useEffect(() => {
    const onBack = (e: Event) => {
      if (sel) { e.preventDefault(); setSel(null); setSheet('peek'); }
      else if (sheet !== 'peek') { e.preventDefault(); setSheet('peek'); }
    };
    window.addEventListener(BACK_EVENT, onBack);
    return () => window.removeEventListener(BACK_EVENT, onBack);
  }, [sel, sheet]);

  const filtered = useMemo(() => aeds.filter((a) =>
    (!onlyOpen || availability(a, now) === 'open') && (!only247 || is247(a.godziny_dostepnosci)) && (!onlyPublic || a.dostep === 'publiczny')),
  [aeds, onlyOpen, only247, onlyPublic, now]);

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { zoomControl: false, preferCanvas: true }).setView(BYDGOSZCZ, 13);
    L.control.zoom({ position: 'bottomright', zoomInTitle: 'Przybliż', zoomOutTitle: 'Oddal' }).addTo(map);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">współtwórcy OpenStreetMap</a>',
    }).addTo(map);
    // Czujnik podkładu mapy: przy „Wi-Fi bez internetu” przeglądarka twierdzi, że jest online, a kafelki wiszą.
    // Jeśli widoczne kafelki nie wczytają się w 10 s — mówimy o tym wprost (dane AED działają bez sieci).
    let tileTimer: number | undefined;
    tiles.on('loading', () => { window.clearTimeout(tileTimer); tileTimer = window.setTimeout(() => setTilesDown(true), 10000); });
    tiles.on('load', () => { window.clearTimeout(tileTimer); setTilesDown(false); });
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
      m.on('click', () => { setSel(a); setSheet('mid'); });
      return m;
    }));
    cluster.addTo(map);
    clusterRef.current = cluster;
  }, [filtered, now]);

  const selMarker = useRef<L.Marker | null>(null);
  useEffect(() => {
    selMarker.current?.remove();
    if (sel && mapRef.current) {
      selMarker.current = L.marker([sel.lat, sel.lon], { icon: markerIcon(availability(sel, now), true), zIndexOffset: 1000, interactive: false, keyboard: false }).addTo(mapRef.current);
      // pinezka zaznaczenia jest tylko wizualna (AED ma już swój znacznik i kartę szczegółów) — ukryta przed czytnikami ekranu
      const el = selMarker.current.getElement();
      el?.removeAttribute('role'); el?.removeAttribute('tabindex'); el?.setAttribute('aria-hidden', 'true');
    }
  }, [sel, now]);

  const ref = me ?? center;
  const nearest = useMemo(() => filtered
    .map((a) => ({ a, d: distanceM(ref[0], ref[1], a.lat, a.lon) }))
    .sort((x, y) => x.d - y.d).slice(0, 8), [filtered, ref[0], ref[1]]);

  // Lokalizacja doprecyzowywana: pierwszy odczyt (często z sieci, ±100–500 m) pokazujemy od razu,
  // a przez kolejne sekundy przyjmujemy lepsze odczyty z GPS, aż dokładność spadnie poniżej 30 m.
  const watchRef = useRef<number | null>(null);
  useEffect(() => () => { if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current); }, []);

  function locate() {
    setGeoMsg('Ustalam Twoją lokalizację…');
    if (!navigator.geolocation) { setGeoMsg('Twoje urządzenie nie udostępnia lokalizacji.'); return; }
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    let best = Infinity;
    let first = true;
    const stop = () => { if (watchRef.current !== null) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null; } };
    const apply = (p: GeolocationPosition) => {
      const acc = Math.round(p.coords.accuracy || 9999);
      if (acc >= best) return; // przyjmujemy tylko dokładniejsze odczyty
      best = acc;
      const pos: [number, number] = [p.coords.latitude, p.coords.longitude];
      setMe(pos); setAccuracy(acc);
      setGeoMsg(acc > 30 ? `Doprecyzowuję lokalizację… (±${acc} m)` : '');
      const map = mapRef.current!;
      meRef.current?.remove();
      accRef.current?.remove();
      // okrąg dokładności: użytkownik widzi, na ile pewna jest jego pozycja (sieć ±100 m vs GPS ±5 m)
      if (acc > 15) accRef.current = L.circle(pos, { radius: acc, color: '#1565c0', weight: 1, fillColor: '#1565c0', fillOpacity: 0.12, interactive: false }).addTo(map);
      meRef.current = L.circleMarker(pos, { radius: 9, color: '#fff', weight: 3, fillColor: '#1565c0', fillOpacity: 1 }).addTo(map).bindTooltip(`Tu jesteś (±${acc} m)`);
      const n = filtered.map((a) => ({ a, d: distanceM(pos[0], pos[1], a.lat, a.lon) })).sort((x, y) => x.d - y.d)[0];
      if (n) { setSel(n.a); showOnMap([pos, [n.a.lat, n.a.lon]]); } else map.setView(pos, 16);
      if (first) { setSheet('mid'); first = false; }
      if (acc <= 30) stop();
    };
    watchRef.current = navigator.geolocation.watchPosition(apply,
      (e) => { if (first) setGeoMsg(e.code === 1 ? 'Brak zgody na lokalizację. Przesuń mapę albo wybierz miasto.' : 'Nie udało się ustalić lokalizacji.'); stop(); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    window.setTimeout(() => { stop(); setGeoMsg(''); }, 15000);
  }

  // wyszukiwarka (bez polskich znaków) w nazwie, opisie, adresie i dysponencie. Wygrywają AED pasujące do
  // największej liczby słów (wiele AED z OSM nie ma nazwy miasta w danych), posortowane wg odległości od środka mapy.
  const [q, setQ] = useState('');
  const index = useMemo(() => aeds.map((a) => [fold(`${a.nazwa} ${a.opis_lokalizacji} ${a.nazwa_ulicy} ${a.nr_budynku} ${a.miejscowosc} ${a.dysponent}`), a] as const), [aeds]);
  const hits = useMemo(() => {
    const words = fold(q).split(/\s+/).filter((w) => w.length >= 2);
    if (!words.length || q.trim().length < 3) return [];
    const ref0 = me ?? center;
    // waga słowa = jego rzadkość (IDF): „focus” znaczy więcej niż częste „bydgoszcz”
    const idf = words.map((w) => { let df = 0; for (const [t] of index) if (t.includes(w)) df++; return df ? Math.log(index.length / df) : 0; });
    const scored: { a: Aed; s: number; d: number }[] = [];
    for (const [t, a] of index) {
      let s = 0;
      words.forEach((w, i) => { if (t.includes(w)) s += idf[i]; });
      if (s > 0) scored.push({ a, s, d: distanceM(ref0[0], ref0[1], a.lat, a.lon) });
    }
    return scored.sort((x, y) => y.s - x.s || x.d - y.d).slice(0, 6).map((x) => x.a);
  }, [q, index]);

  // Pokazuje punkty w WIDOCZNEJ części mapy: na telefonie nad panelem (zajmuje dolną połowę ekranu)
  function showOnMap(pts: [number, number][]) {
    const map = mapRef.current; if (!map) return;
    const mobile = window.innerWidth <= 900;
    const b = L.latLngBounds(pts);
    map.fitBounds(b, mobile
      ? { paddingTopLeft: [40, 90], paddingBottomRight: [40, Math.round(window.innerHeight * 0.52) + 30], maxZoom: 18 }
      : { padding: [60, 60], maxZoom: 18 });
  }

  function focus(a: Aed) {
    setSel(a); setSheet('mid');
    showOnMap([[a.lat, a.lon]]);
  }

  return (
    <div className={`map-layout ${sheet !== 'peek' ? 'sheet-up' : ''}`}>
      <div ref={mapEl} className="map" role="application" aria-label="Mapa defibrylatorów AED. Lista najbliższych AED znajduje się w panelu." />

      <div className="map-toolbar">
        <div className="toolbar-row">
          <button className="btn btn-primary btn-lg" onClick={locate}><IconLocate /> Najbliższy AED</button>
          <Link className="btn btn-lg btn-rescue" to="/ratunek" aria-label="Tryb ratunkowy: najbliższy dostępny AED i metronom RKO">SOS</Link>
        </div>
        <div className="map-search" role="search">
          <label className="sr-only" htmlFor="aed-q">Szukaj AED: miasto, obiekt, ulica lub dysponent</label>
          <input id="aed-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj: miasto, obiekt, ulica, dysponent…" autoComplete="off"
            role="combobox" aria-autocomplete="list" aria-controls="aed-q-list" aria-expanded={hits.length > 0} onKeyDown={(e) => { if (e.key === 'Enter' && hits[0]) { focus(hits[0]); setQ(''); } if (e.key === 'Escape') setQ(''); }} />
          {hits.length > 0 && (
            <ul id="aed-q-list" className="map-search-list">
              {hits.map((a) => (
                <li key={a.aed_uid}><button type="button" onClick={() => { focus(a); setQ(''); }}>
                  <b>{displayName(a)}</b><span>{[a.opis_lokalizacji, shortAddress(a)].filter(Boolean).join(' · ') || 'brak opisu'}</span>
                </button></li>
              ))}
            </ul>
          )}
          {q.trim().length >= 3 && hits.length === 0 && <p className="map-search-empty" role="status">Brak AED pasujących do „{q}”.</p>}
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
        {tilesDown && <p className="geo-msg tiles-down" role="status"><b>Brak połączenia z serwerem map.</b> Podkład mapy może się nie wyświetlać, ale lista najbliższych AED, nawigacja i tryb ratunkowy działają bez internetu.</p>}
      </div>

      <section className={`sheet ${sheet}`} aria-label="Panel informacji o AED">
        <button className="sheet-handle" onClick={() => setSheet(sheet === 'peek' ? 'mid' : sheet === 'mid' ? 'full' : 'peek')} aria-expanded={sheet !== 'peek'}>
          <span className="sr-only">{sheet === 'full' ? 'Zwiń panel' : 'Rozwiń panel'}</span>
        </button>
        {sel ? <Details a={sel} me={me} now={now} accuracy={accuracy} onClose={() => { setSel(null); setSheet('peek'); }} /> : (
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

function Details({ a, me, now, onClose, accuracy }: { a: Aed; me: [number, number] | null; now: Date; onClose: () => void; accuracy: number | null }) {
  const av = availability(a, now);
  const d = me ? distanceM(me[0], me[1], a.lat, a.lon) : null;
  const nav = `https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lon}&travelmode=walking`;
  const q = Number(a.jakosc);
  const [shared, setShared] = useState('');
  useEffect(() => setShared(''), [a.aed_uid]);
  async function share(x: Aed) {
    const url = aedLink(x.aed_uid);
    const sub = subLine(x);
    const text = `AED: ${displayName(x)}${sub && !sub.startsWith('brak opisu') ? ` — ${sub}` : ''}`;
    if ((await shareText({ title: 'AEDostępni', text, url })) === 'copied') setShared('Skopiowano link ✓');
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
      {d !== null && <p className="dist-line"><b>{fmtDist(d)}</b> · szybkim marszem ~{walkMinutes(d)} min w jedną stronę{accuracy && accuracy > 50 ? <span className="muted"> (Twoja lokalizacja ±{accuracy} m)</span> : null}</p>}
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
