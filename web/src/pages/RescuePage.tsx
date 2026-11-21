import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadAeds, availability, distanceM, walkMinutes, fmtDist, address, is247 } from '../data';
import type { Aed } from '../data';

type Found = { a: Aed; d: number };
const BPM = 110;

/** Tryb ratunkowy: 112 → najbliższy AED dostępny teraz → wyślij kogoś → metronom RKO. */
export default function RescuePage() {
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [err, setErr] = useState('');
  const [list, setList] = useState<Found[]>([]);
  const [shared, setShared] = useState('');

  useEffect(() => {
    if (!navigator.geolocation) { setErr('To urządzenie nie udostępnia lokalizacji.'); return; }
    const id = navigator.geolocation.watchPosition(
      (p) => setPos([p.coords.latitude, p.coords.longitude]),
      (e) => setErr(e.code === 1 ? 'Brak zgody na lokalizację — włącz ją albo użyj zwykłej mapy.' : 'Nie udało się ustalić lokalizacji. Spróbuj na zewnątrz budynku.'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  useEffect(() => {
    if (!pos) return;
    loadAeds().then((all) => {
      const now = new Date();
      const near = all.map((a) => ({ a, d: distanceM(pos[0], pos[1], a.lat, a.lon) })).filter((x) => x.d < 5000).sort((x, y) => x.d - y.d);
      // najpierw dostępne teraz, potem o nieznanych godzinach (mogą być dostępne), nigdy zamknięte
      const open = near.filter((x) => availability(x.a, now) === 'open');
      const unknown = near.filter((x) => availability(x.a, now) === 'unknown');
      setList([...open.slice(0, 3), ...unknown.slice(0, 2)].sort((x, y) => x.d - y.d).slice(0, 4));
    });
  }, [pos?.[0], pos?.[1]]);

  const best = list[0];
  const navUrl = (a: Aed) => `https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lon}&travelmode=walking`;

  async function sendRunner(a: Aed) {
    const text = `PILNE! Przynieś AED: ${a.nazwa}. ${a.opis_lokalizacji ? `Gdzie: ${a.opis_lokalizacji}. ` : ''}Nawigacja: ${navUrl(a)}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Przynieś AED', text }); setShared('Wysłano.'); }
      else { await navigator.clipboard.writeText(text); setShared('Skopiowano treść — wklej w SMS lub komunikatorze.'); }
    } catch { /* anulowano */ }
  }

  return (
    <div className="rescue">
      <div className="rescue-head">
        <Link to="/" className="rescue-back" aria-label="Wyjdź z trybu ratunkowego">✕</Link>
        <h1>Tryb ratunkowy</h1>
      </div>

      <a className="rescue-112" href="tel:112">
        <span className="big">1</span>
        <span>Zadzwoń <b>112</b><small>Włącz głośnik. Dyspozytor poprowadzi Cię krok po kroku.</small></span>
      </a>

      <section className="rescue-step" aria-labelledby="r2">
        <h2 id="r2"><span className="big">2</span> Najbliższy AED</h2>
        {!pos && !err && <p role="status" className="pulse-text">Szukam Twojej lokalizacji…</p>}
        {err && <p className="error" role="alert">{err} <Link to="/">Otwórz mapę</Link></p>}
        {pos && list.length === 0 && <p>W promieniu 5 km nie znamy dostępnego teraz AED. Kontynuuj RKO do przyjazdu pogotowia.</p>}
        {best && (
          <div className="rescue-aed">
            <p className="rescue-dist"><b>{fmtDist(best.d)}</b> · tam i z powrotem ~{walkMinutes(best.d) * 2} min</p>
            <p className="rescue-name">{best.a.nazwa}</p>
            {!(best.a.opis_lokalizacji && best.a.nazwa.includes(best.a.opis_lokalizacji)) && <p className="rescue-where">{best.a.opis_lokalizacji || address(best.a)}</p>}
            <p className="muted">{is247(best.a.godziny_dostepnosci) ? 'Dostępny całodobowo' : availability(best.a) === 'open' ? 'Dostępny teraz' : 'Godziny nieznane — może być dostępny'}</p>
            <div className="btn-row">
              <button className="btn btn-primary btn-lg" onClick={() => sendRunner(best.a)}>Wyślij kogoś po AED</button>
              <a className="btn btn-lg" href={navUrl(best.a)} target="_blank" rel="noopener">Prowadź</a>
            </div>
            {shared && <p role="status" className="muted">{shared}</p>}
            {list.length > 1 && (
              <details>
                <summary>Inne AED w pobliżu ({list.length - 1})</summary>
                <ul className="issue-list">{list.slice(1).map(({ a, d }) => <li key={a.aed_uid}><b>{fmtDist(d)}</b> — {a.nazwa} <a href={navUrl(a)} target="_blank" rel="noopener">prowadź</a></li>)}</ul>
              </details>
            )}
          </div>
        )}
      </section>

      <section className="rescue-step" aria-labelledby="r3">
        <h2 id="r3"><span className="big">3</span> Uciskaj klatkę piersiową</h2>
        <Metronome />
        <p className="muted small">Środek klatki piersiowej, ręce wyprostowane, głębokość 5–6 cm, tempo 100–120/min. Gdy przyniosą AED — włącz go i wykonuj polecenia głosowe.</p>
      </section>
    </div>
  );
}

function Metronome() {
  const [on, setOn] = useState(false);
  const [count, setCount] = useState(0);
  const ctx = useRef<AudioContext | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); ctx.current?.close(); }, []);

  function beep() {
    const c = ctx.current; if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = 880; g.gain.setValueAtTime(0.35, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.09);
  }
  function toggle() {
    if (on) { if (timer.current) clearInterval(timer.current); timer.current = null; setOn(false); return; }
    ctx.current = ctx.current || new (window.AudioContext || (window as any).webkitAudioContext)();
    ctx.current.resume();
    setCount(0); setOn(true);
    timer.current = window.setInterval(() => {
      beep(); navigator.vibrate?.(50);
      setCount((n) => n + 1);
    }, 60000 / BPM);
  }
  const inCycle = count % 30;
  return (
    <div className="metronome">
      <button className={`metro-btn ${on ? 'on' : ''}`} onClick={toggle} aria-pressed={on} style={{ animationDuration: `${60 / BPM}s` }}>
        {on ? 'Stop' : 'Start metronomu'}
        <small>{BPM} uciśnięć/min</small>
      </button>
      <p className="metro-count" aria-live="off">{on ? <><b>{inCycle === 0 && count > 0 ? 30 : inCycle}</b> / 30</> : 'Uciskaj w rytm sygnału'}</p>
      {on && count > 0 && inCycle === 0 && <p className="notice notice-warn" role="status">Jeśli umiesz — 2 oddechy ratownicze. Jeśli nie — uciskaj dalej bez przerwy.</p>}
    </div>
  );
}
