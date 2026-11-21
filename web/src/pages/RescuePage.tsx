import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadAeds, availability, distanceM, walkMinutes, fmtDist, is247, displayName, subLine } from '../data';
import type { Aed } from '../data';

type Found = { a: Aed; d: number };
type Lang = 'pl' | 'en' | 'uk';
const BPM = 110;

// Tryb ratunkowy w 3 językach — dla turystów i osób z Ukrainy (najliczniejsza grupa cudzoziemców w Polsce).
const T = {
  pl: {
    title: 'Tryb ratunkowy', exit: 'Wyjdź z trybu ratunkowego', call: 'Zadzwoń', callHint: 'Włącz głośnik. Dyspozytor poprowadzi Cię krok po kroku.',
    nearest: 'Najbliższy AED', locating: 'Szukam Twojej lokalizacji…', openMap: 'Otwórz mapę', noGeo: 'To urządzenie nie udostępnia lokalizacji.',
    denied: 'Brak zgody na lokalizację — włącz ją albo użyj zwykłej mapy.', geoFail: 'Nie udało się ustalić lokalizacji. Spróbuj na zewnątrz budynku.',
    none: 'W promieniu 5 km nie znamy dostępnego teraz AED. Kontynuuj RKO do przyjazdu pogotowia.', roundTrip: 'tam i z powrotem',
    h247: 'Dostępny całodobowo', open: 'Dostępny teraz', unknown: 'Godziny nieznane — może być dostępny',
    send: 'Wyślij kogoś po AED', navigate: 'Prowadź', others: 'Inne AED w pobliżu', sent: 'Wysłano.', copied: 'Skopiowano treść — wklej w SMS lub komunikatorze.',
    urgent: 'PILNE! Przynieś AED', where: 'Gdzie', nav: 'Nawigacja',
    cpr: 'Uciskaj klatkę piersiową', cprHint: 'Środek klatki piersiowej, ręce wyprostowane, głębokość 5–6 cm, tempo 100–120/min. Gdy przyniosą AED — włącz go i wykonuj polecenia głosowe.',
    start: 'Start metronomu', stop: 'Stop', perMin: 'uciśnięć/min', rhythm: 'Uciskaj w rytm sygnału', breaths: 'Jeśli umiesz — 2 oddechy ratownicze. Jeśli nie — uciskaj dalej bez przerwy.',
  },
  en: {
    title: 'Emergency mode', exit: 'Exit emergency mode', call: 'Call', callHint: 'Turn on the speaker. The dispatcher will guide you step by step.',
    nearest: 'Nearest AED', locating: 'Finding your location…', openMap: 'Open the map', noGeo: 'This device does not share its location.',
    denied: 'Location permission denied — enable it or use the regular map.', geoFail: 'Could not get your location. Try outside the building.',
    none: 'We know of no AED available now within 5 km. Continue CPR until the ambulance arrives.', roundTrip: 'there and back',
    h247: 'Available 24/7', open: 'Available now', unknown: 'Opening hours unknown — may be available',
    send: 'Send someone for the AED', navigate: 'Navigate', others: 'Other AEDs nearby', sent: 'Sent.', copied: 'Copied — paste it into an SMS or messenger.',
    urgent: 'URGENT! Bring the AED', where: 'Where', nav: 'Directions',
    cpr: 'Push hard on the chest', cprHint: 'Centre of the chest, straight arms, 5–6 cm deep, 100–120 per minute. When the AED arrives — switch it on and follow the voice prompts.',
    start: 'Start metronome', stop: 'Stop', perMin: 'compressions/min', rhythm: 'Push to the beat', breaths: 'If trained — give 2 rescue breaths. If not — keep pushing without pause.',
  },
  uk: {
    title: 'Екстрений режим', exit: 'Вийти з екстреного режиму', call: 'Телефонуйте', callHint: 'Увімкніть гучний зв’язок. Диспетчер підкаже, що робити.',
    nearest: 'Найближчий AED', locating: 'Визначаю ваше місцезнаходження…', openMap: 'Відкрити мапу', noGeo: 'Цей пристрій не надає геолокацію.',
    denied: 'Немає дозволу на геолокацію — увімкніть її або скористайтеся мапою.', geoFail: 'Не вдалося визначити місцезнаходження. Спробуйте надворі.',
    none: 'У радіусі 5 км немає відомого доступного зараз AED. Продовжуйте СЛР до приїзду швидкої.', roundTrip: 'туди й назад',
    h247: 'Доступний цілодобово', open: 'Доступний зараз', unknown: 'Години невідомі — може бути доступний',
    send: 'Відправте когось по AED', navigate: 'Маршрут', others: 'Інші AED поблизу', sent: 'Надіслано.', copied: 'Скопійовано — вставте в SMS або месенджер.',
    urgent: 'ТЕРМІНОВО! Принесіть AED', where: 'Де', nav: 'Маршрут',
    cpr: 'Натискайте на грудну клітку', cprHint: 'Центр грудної клітки, прямі руки, глибина 5–6 см, 100–120 за хвилину. Коли принесуть AED — увімкніть його й виконуйте голосові вказівки.',
    start: 'Старт метронома', stop: 'Стоп', perMin: 'натискань/хв', rhythm: 'Натискайте в ритм сигналу', breaths: 'Якщо вмієте — 2 рятувальні вдихи. Якщо ні — продовжуйте натискання без перерви.',
  },
} as const;
const LANGS: { code: Lang; label: string; name: string }[] = [{ code: 'pl', label: 'PL', name: 'Polski' }, { code: 'en', label: 'EN', name: 'English' }, { code: 'uk', label: 'UA', name: 'Українська' }];

function initialLang(): Lang {
  try { const s = localStorage.getItem('aedostepni-lang'); if (s === 'pl' || s === 'en' || s === 'uk') return s; } catch { /* brak dostępu */ }
  const n = (navigator.language || 'pl').slice(0, 2);
  return n === 'uk' || n === 'ru' ? 'uk' : n === 'pl' ? 'pl' : 'en';
}

/** Tryb ratunkowy: 112 → najbliższy AED dostępny teraz → wyślij kogoś → metronom RKO. */
export default function RescuePage() {
  const [lang, setLang] = useState<Lang>(initialLang);
  const t = T[lang];
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [err, setErr] = useState<'' | 'noGeo' | 'denied' | 'geoFail'>('');
  const [list, setList] = useState<Found[]>([]);
  const [shared, setShared] = useState<'' | 'sent' | 'copied'>('');

  function chooseLang(l: Lang) { setLang(l); try { localStorage.setItem('aedostepni-lang', l); } catch { /* ignoruj */ } }
  useEffect(() => { document.documentElement.lang = lang; return () => { document.documentElement.lang = 'pl'; }; }, [lang]);

  useEffect(() => {
    if (!navigator.geolocation) { setErr('noGeo'); return; }
    const id = navigator.geolocation.watchPosition(
      (p) => setPos([p.coords.latitude, p.coords.longitude]),
      (e) => setErr(e.code === 1 ? 'denied' : 'geoFail'),
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
    const text = `${t.urgent}: ${displayName(a)}. ${a.opis_lokalizacji ? `${t.where}: ${a.opis_lokalizacji}. ` : ''}${t.nav}: ${navUrl(a)}`;
    try {
      if (navigator.share) { await navigator.share({ title: t.urgent, text }); setShared('sent'); }
      else { await navigator.clipboard.writeText(text); setShared('copied'); }
    } catch { /* anulowano */ }
  }

  return (
    <div className="rescue" lang={lang}>
      <div className="rescue-head">
        <Link to="/" className="rescue-back" aria-label={t.exit}>✕</Link>
        <h1>{t.title}</h1>
        <div className="lang-switch" role="radiogroup" aria-label="Język / Language / Мова">
          {LANGS.map((l) => (
            <button key={l.code} role="radio" aria-checked={lang === l.code} aria-label={l.name} lang={l.code} className={lang === l.code ? 'on' : ''} onClick={() => chooseLang(l.code)}>{l.label}</button>
          ))}
        </div>
      </div>

      <a className="rescue-112" href="tel:112">
        <span className="big">1</span>
        <span>{t.call} <b>112</b><small>{t.callHint}</small></span>
      </a>

      <section className="rescue-step" aria-labelledby="r2">
        <h2 id="r2"><span className="big">2</span> {t.nearest}</h2>
        {!pos && !err && <p role="status" className="pulse-text">{t.locating}</p>}
        {err && <p className="error" role="alert">{t[err]} <Link to="/">{t.openMap}</Link></p>}
        {pos && list.length === 0 && <p>{t.none}</p>}
        {best && (
          <div className="rescue-aed">
            <p className="rescue-dist"><b>{fmtDist(best.d)}</b> · {t.roundTrip} ~{walkMinutes(best.d) * 2} min</p>
            <p className="rescue-name">{displayName(best.a)}</p>
            {subLine(best.a) && <p className="rescue-where">{subLine(best.a)}</p>}
            <p className="muted">{is247(best.a.godziny_dostepnosci) ? t.h247 : availability(best.a) === 'open' ? t.open : t.unknown}</p>
            <div className="btn-row">
              <button className="btn btn-primary btn-lg" onClick={() => sendRunner(best.a)}>{t.send}</button>
              <a className="btn btn-lg" href={navUrl(best.a)} target="_blank" rel="noopener">{t.navigate}</a>
            </div>
            {shared && <p role="status" className="muted">{t[shared]}</p>}
            {list.length > 1 && (
              <details>
                <summary>{t.others} ({list.length - 1})</summary>
                <ul className="issue-list">{list.slice(1).map(({ a, d }) => <li key={a.aed_uid}><b>{fmtDist(d)}</b> — {displayName(a)} <a href={navUrl(a)} target="_blank" rel="noopener">{t.navigate.toLowerCase()}</a></li>)}</ul>
              </details>
            )}
          </div>
        )}
      </section>

      <section className="rescue-step" aria-labelledby="r3">
        <h2 id="r3"><span className="big">3</span> {t.cpr}</h2>
        <Metronome t={t} />
        <p className="muted small">{t.cprHint}</p>
      </section>
    </div>
  );
}

function Metronome({ t }: { t: (typeof T)[Lang] }) {
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
        {on ? t.stop : t.start}
        <small>{BPM} {t.perMin}</small>
      </button>
      <p className="metro-count" aria-live="off">{on ? <><b>{inCycle === 0 && count > 0 ? 30 : inCycle}</b> / 30</> : t.rhythm}</p>
      {on && count > 0 && inCycle === 0 && <p className="notice notice-warn" role="status">{t.breaths}</p>}
    </div>
  );
}
