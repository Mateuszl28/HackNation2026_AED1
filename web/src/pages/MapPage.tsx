import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BACK_EVENT } from '../native';
import { aedLink } from '../config';
import { shareText } from '../share';
import { reverseAddress } from '../geocode';
import VerifyAed from '../components/VerifyAed';
import { watchFresh, setManualFix, getManualFix, clearManualFix } from '../geo';
import type { Fix, GeoErr } from '../geo';
import L from 'leaflet';
import 'leaflet.markercluster';
import { describeHours } from '@shared/hours.ts';
import {
  loadAeds, availability, distanceM, walkMinutes, fmtDist, address, is247, sourceList, displayName, subLine, shortAddress,
  ACCESS_LABEL, SECURITY_LABEL, BYDGOSZCZ, DATA_INFO,
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
  const [manual, setManual] = useState(false);
  const [picking, setPicking] = useState(false);
  const pickingRef = useRef(false);
  useEffect(() => { pickingRef.current = picking; }, [picking]);
  const [myAddr, setMyAddr] = useState('');
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
    if (!aeds.length || !mapRef.current) return;
    if (search.get('pick') === '1') { setSearch({}, { replace: true }); startPick(); return; }
    if (search.get('locate') !== '1') return;
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
    // Uwaga: Leaflet zgłasza „load” także gdy kafelki się NIE wczytały, więc sprawdzamy rzeczywiście wczytane obrazy.
    const loadedTiles = () => Array.from(mapEl.current?.querySelectorAll<HTMLImageElement>('img.leaflet-tile') || []).filter((img) => img.complete && img.naturalWidth > 0).length;
    const check = () => setTilesDown(loadedTiles() === 0);
    const tileTimer = window.setInterval(check, 5000);
    window.setTimeout(check, 10000);
    tiles.on('tileload', () => setTilesDown(false));
    map.on('remove', () => window.clearInterval(tileTimer));
    map.on('moveend', () => { const c = map.getCenter(); setCenter([c.lat, c.lng]); });
    map.on('click', (e: L.LeafletMouseEvent) => { if (pickingRef.current) pickRef.current?.(e.latlng.lat, e.latlng.lng); });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    clusterRef.current?.remove();
    // Klaster pokazuje dostępność: zielony = jest AED dostępny teraz (plakietka: ile), bursztynowy = godziny nieznane, szary = żaden teraz
    const cluster = L.markerClusterGroup({
      chunkedLoading: true, maxClusterRadius: 45, showCoverageOnHover: false,
      iconCreateFunction: (c) => {
        const ms = c.getAllChildMarkers();
        const n = c.getChildCount();
        const open = ms.filter((m) => (m.options as { av?: Availability }).av === 'open').length;
        const unknown = ms.some((m) => (m.options as { av?: Availability }).av === 'unknown');
        const cls = open ? 'open' : unknown ? 'unknown' : 'closed';
        const size = n < 10 ? 36 : n < 100 ? 42 : 48;
        const label = `${n} AED${open ? `, ${open} dostępnych teraz` : ''}`;
        return L.divIcon({
          html: `<div title="${label}"><span>${n}</span>${open && open < n ? `<i>${open}</i>` : ''}</div>`,
          className: `aed-cluster aed-cluster-${cls}`, iconSize: L.point(size, size),
        });
      },
    });
    cluster.addLayers(filtered.map((a) => {
      const av = availability(a, now);
      const m = L.marker([a.lat, a.lon], { icon: markerIcon(av), title: displayName(a), alt: `${displayName(a)} — ${AV_LABEL[av]}`, keyboard: true, av } as L.MarkerOptions);
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

  // Lokalizacja AKTUALNA (geo.ts): natywny GPS w aplikacji, odrzucanie zapamiętanych odczytów.
  // Pierwszy świeży odczyt pokazujemy od razu, potem przyjmujemy dokładniejsze, aż do ±25 m (najwyżej 30 s).
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => () => stopRef.current?.(), []);

  /** Rysuje „Tu jesteś” (z okręgiem dokładności) i pokazuje najbliższy AED. */
  function placeMe(pos: [number, number], acc: number, isManual: boolean, openSheet = true) {
    setMe(pos); setAccuracy(acc); setManual(isManual);
    const map = mapRef.current!;
    meRef.current?.remove();
    accRef.current?.remove();
    // okrąg dokładności: użytkownik widzi, na ile pewna jest jego pozycja (sieć ±100 m vs GPS ±5 m)
    if (acc > 15) accRef.current = L.circle(pos, { radius: acc, color: '#1565c0', weight: 1, fillColor: '#1565c0', fillOpacity: 0.12, interactive: false }).addTo(map);
    meRef.current = L.circleMarker(pos, { radius: 9, color: '#fff', weight: 3, fillColor: '#1565c0', fillOpacity: 1 }).addTo(map)
      .bindTooltip(isManual ? 'Tu jesteś (wskazane ręcznie)' : `Tu jesteś (±${acc} m)`);
    // najbliższy, który NIE jest teraz zamknięty (jak w trybie ratunkowym); gdy takiego brak — po prostu najbliższy
    const sorted = filtered.map((a) => ({ a, d: distanceM(pos[0], pos[1], a.lat, a.lon) })).sort((x, y) => x.d - y.d);
    const n = sorted.slice(0, 50).find((x) => availability(x.a, new Date()) !== 'closed') || sorted[0];
    if (n) { setSel(n.a); showOnMap([pos, [n.a.lat, n.a.lon]]); } else map.setView(pos, 16);
    if (openSheet) setSheet('mid');
  }

  // „Nie tutaj?” — telefon w budynku bywa bez GPS, a pozycja z Wi-Fi potrafi wskazać inne miasto.
  function startPick() {
    stopRef.current?.(); stopRef.current = null;
    setGeoMsg(''); setSel(null); setSheet('peek'); setPicking(true);
  }
  const pickRef = useRef<((lat: number, lon: number) => void) | null>(null);
  pickRef.current = (lat, lon) => { setPicking(false); setManualFix(lat, lon); placeMe([lat, lon], 0, true); };

  // przybliżony adres „Tu jesteś” — także po to, by podać go dyspozytorowi 112
  const meKey = me ? `${me[0].toFixed(3)},${me[1].toFixed(3)}` : '';
  useEffect(() => {
    if (!me) { setMyAddr(''); return; }
    let alive = true;
    reverseAddress(me[0], me[1]).then((s) => { if (alive) setMyAddr(s); }).catch(() => {});
    return () => { alive = false; };
  }, [meKey]);

  function locate(useGps = false) {
    // pozycja wskazana ręcznie (ostatnie 30 min) ma pierwszeństwo — chyba że użytkownik prosi o GPS
    const m = useGps ? null : getManualFix();
    if (m) { setGeoMsg(''); placeMe([m.lat, m.lon], 0, true); return; }
    clearManualFix(); setManual(false);
    setGeoMsg('Ustalam aktualną lokalizację (GPS)…');
    stopRef.current?.();
    let best = Infinity;
    let first = true;
    let timer = 0;
    const stop = () => { stopRef.current?.(); stopRef.current = null; window.clearTimeout(timer); };
    const apply = (f: Fix) => {
      const acc = f.acc;
      if (acc >= best) return; // przyjmujemy tylko dokładniejsze odczyty
      best = acc;
      setGeoMsg(acc > 25 ? `Doprecyzowuję lokalizację GPS… (teraz ±${acc} m)` : '');
      placeMe([f.lat, f.lon], acc, false, first);
      first = false;
      if (acc <= 25) { stop(); setGeoMsg(''); }
    };
    const fail = (e: GeoErr) => {
      if (!first) return; // mamy już aktualną pozycję — ignorujemy późniejsze błędy
      setGeoMsg(e === 'denied'
        ? 'Brak zgody na lokalizację. Włącz ją w ustawieniach aplikacji albo przesuń mapę ręcznie.'
        : 'Nie udało się ustalić aktualnej lokalizacji. Sprawdź, czy lokalizacja (GPS) jest włączona, i podejdź bliżej okna.');
      stop();
    };
    stopRef.current = watchFresh(apply, fail);
    timer = window.setTimeout(() => { if (first) fail('timeout'); else { stop(); setGeoMsg(''); } }, 30000);
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
      ? { paddingTopLeft: [40, 90], paddingBottomRight: [40, Math.round(window.innerHeight * 0.52) + 30], maxZoom: 17 }
      : { padding: [60, 60], maxZoom: 17 });
  }

  function focus(a: Aed) {
    setSel(a); setSheet('mid');
    showOnMap([[a.lat, a.lon]]);
  }

  return (
    <div className={`map-layout ${sheet !== 'peek' ? 'sheet-up' : ''}`}>
      <div ref={mapEl} className={`map ${picking ? "is-picking" : ""}`} role="application" aria-label="Mapa defibrylatorów AED. Lista najbliższych AED znajduje się w panelu." />

      <div className="map-toolbar">
        <div className="toolbar-row">
          <button className="btn btn-primary btn-lg" onClick={() => locate()}><IconLocate /> Najbliższy AED</button>
          <Link className="btn btn-lg btn-rescue" to="/ratunek" aria-label="Tryb ratunkowy: najbliższy dostępny AED i metronom RKO">SOS</Link>
        </div>
        <div className="map-search" role="search">
          <label className="sr-only" htmlFor="aed-q">Szukaj AED: miasto, obiekt, ulica lub dysponent</label>
          <svg className="map-search-ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z" /></svg>
          <input id="aed-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj AED, miejsca, ulicy…" autoComplete="off"
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
        {picking ? (
          <p className="loc-bar picking" role="status"><span><b>Dotknij mapy tam, gdzie jesteś.</b> Przesuń i przybliż mapę, jeśli trzeba.</span>
            <button className="loc-bar-btn" onClick={() => setPicking(false)}>Anuluj</button></p>
        ) : me && (
          <p className="loc-bar" role="status"><span>📍 Jesteś tu: <b>{myAddr || `${me[0].toFixed(4)}, ${me[1].toFixed(4)}`}</b> <small>{manual ? '(wskazane ręcznie)' : accuracy ? `(±${accuracy} m)` : ''}</small></span>
            {manual && <button className="loc-bar-btn" onClick={() => locate(true)}>Użyj GPS</button>}
            <button className="loc-bar-btn" onClick={startPick}>{manual ? 'Zmień' : 'Nie tutaj?'}</button></p>
        )}
        {tilesDown && <p className="geo-msg tiles-down" role="status"><b>Brak połączenia z serwerem map.</b> Podkład mapy może się nie wyświetlać, ale lista najbliższych AED, nawigacja i tryb ratunkowy działają bez internetu.</p>}
      </div>

      {/* pływające przyciski na telefonie (pod kciukiem, nad panelem) */}
      <div className="fabs">
        <Link className="fab fab-sos" to="/ratunek" aria-label="SOS: tryb ratunkowy — 112, najbliższy AED, metronom RKO">SOS</Link>
        <button className="fab fab-locate" onClick={() => locate()} aria-label="Pokaż najbliższy AED"><IconLocate /><span>Najbliższy AED</span></button>
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
            <Link className="quiz-link" to="/quiz">🎓 <span><b>Czy wiesz, jak użyć AED?</b> Quiz — 60 sekund</span><span className="chev" aria-hidden="true">›</span></Link>
            <div className="sheet-title">
              <h2>{me ? 'Najbliżej Ciebie' : 'Najbliżej środka mapy'}</h2>
              <span>{filtered.length.toLocaleString('pl-PL')} AED{DATA_INFO.generated && <> · dane z {new Date(DATA_INFO.generated).toLocaleDateString('pl-PL')}</>}</span>
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
  // przybliżony adres z OSM, gdy dane nie mają adresu
  const [approx, setApprox] = useState('');
  useEffect(() => {
    setApprox('');
    if (shortAddress(a)) return;
    let alive = true;
    reverseAddress(a.lat, a.lon).then((s) => { if (alive) setApprox(s); }).catch(() => {});
    return () => { alive = false; };
  }, [a.aed_uid]);
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
          <p className="muted">{shortAddress(a) || (approx ? <>ok. {approx} <small>(adres przybliżony, OSM)</small></> : 'adres nieznany')}</p>
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
      <VerifyAed key={a.aed_uid} a={a} />
      <Link className="btn btn-ghost" style={{ width: '100%' }} to={`/zglos?aed=${encodeURIComponent(a.aed_uid)}`}>Zgłoś problem lub popraw dane</Link>
    </div>
  );
}
