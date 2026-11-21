import { useEffect, useRef, useState } from 'react';

const KEY = 'aedostepni-onboarding-v1';

const STEPS = [
  {
    title: 'Najbliższy AED w kilka sekund',
    text: 'AEDostępni pokazuje defibrylatory z całej Polski — ponad 18 tysięcy — i podpowiada, który jest dostępny teraz i jak do niego dojść.',
    icon: 'M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z',
  },
  {
    title: 'Lokalizacja tylko na Twoje żądanie',
    text: 'Gdy dotkniesz „Najbliższy AED” albo „SOS”, telefon zapyta o lokalizację. Używamy jej wyłącznie do wyznaczenia odległości — nie zapisujemy jej i nigdzie nie wysyłamy.',
    icon: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9 3h-2.1A7 7 0 0 0 13 5.1V3h-2v2.1A7 7 0 0 0 5.1 11H3v2h2.1a7 7 0 0 0 5.9 5.9V21h2v-2.1a7 7 0 0 0 5.9-5.9H21v-2z',
  },
  {
    title: 'W nagłym wypadku: SOS',
    text: 'Czerwony przycisk SOS prowadzi krok po kroku: 112, najbliższy AED, wysłanie kogoś po urządzenie i metronom do uciśnięć. Na Androidzie przytrzymaj ikonę aplikacji, by mieć SOS pod ręką.',
    icon: 'M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z',
  },
];

/** Krótkie wprowadzenie przy pierwszym uruchomieniu (raz; można pominąć). Nie pokazujemy go w trybie ratunkowym ani przy linkach do AED. */
export default function Onboarding() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const path = window.location.hash.replace(/^#/, '');
    // tylko przy wejściu na mapę (ekran startowy) — nie przy linkach do podstron, kart AED czy trybu SOS
    const route = path.split('?')[0];
    if ((route !== '' && route !== '/') || path.includes('locate=1')) return;
    try { if (!localStorage.getItem(KEY)) setOpen(true); } catch { /* bez pamięci — nie pokazujemy */ }
  }, []);
  useEffect(() => { if (open) titleRef.current?.focus(); }, [open, i]);

  function close() { try { localStorage.setItem(KEY, '1'); } catch { /* ignoruj */ } setOpen(false); }
  if (!open) return null;
  const s = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <div className="onb-backdrop" role="dialog" aria-modal="true" aria-labelledby="onb-title" onKeyDown={(e) => { if (e.key === 'Escape') close(); }}>
      <div className="onb">
        <button className="onb-skip" onClick={close}>Pomiń</button>
        <div className="onb-icon" aria-hidden="true"><svg width="44" height="44" viewBox="0 0 24 24"><path fill="currentColor" d={s.icon} /></svg></div>
        <h2 id="onb-title" ref={titleRef} tabIndex={-1}>{s.title}</h2>
        <p>{s.text}</p>
        <div className="onb-dots" aria-hidden="true">{STEPS.map((_, k) => <span key={k} className={k === i ? 'on' : ''} />)}</div>
        <p className="sr-only" aria-live="polite">Krok {i + 1} z {STEPS.length}</p>
        <div className="onb-actions">
          {i > 0 && <button className="btn" onClick={() => setI(i - 1)}>Wstecz</button>}
          <button className="btn btn-primary" onClick={() => (last ? close() : setI(i + 1))}>{last ? 'Zaczynamy' : 'Dalej'}</button>
        </div>
      </div>
    </div>
  );
}
