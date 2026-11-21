import { useState } from 'react';
import { createOsmNote } from '../osmNotes';
import type { OsmNote } from '../osmNotes';
import { displayName } from '../data';
import type { Aed } from '../data';

type Ans = 'tak' | 'nie' | 'nie_wiem';
const Q: { key: 'jest' | 'otwarta' | 'gotowy'; label: string }[] = [
  { key: 'jest', label: 'AED jest w tym miejscu' },
  { key: 'otwarta', label: 'Szafkę da się otworzyć bez klucza' },
  { key: 'gotowy', label: 'Wskaźnik gotowości świeci na zielono / „OK”' },
];
const LBL: Record<Ans, string> = { tak: 'Tak', nie: 'Nie', nie_wiem: 'Nie wiem' };
const KEY = 'aedostepni-potwierdzenia';

/** Szybkie potwierdzenie stanu AED przez osobę stojącą przy urządzeniu — odświeża dane (data kontroli w OSM). */
export default function VerifyAed({ a }: { a: Aed }) {
  const [open, setOpen] = useState(false);
  const [ans, setAns] = useState<Partial<Record<'jest' | 'otwarta' | 'gotowy', Ans>>>({});
  const [osm, setOsm] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ note?: OsmNote; err?: string } | null>(null);
  const dev = window.location.hash.includes('osmdev');

  async function send() {
    const today = new Date().toISOString().slice(0, 10);
    const lines = Q.map((q) => `${q.label}: ${LBL[ans[q.key] || 'nie_wiem']}`).join('; ');
    const ok = ans.jest === 'tak' && ans.gotowy === 'tak';
    const text = `[AEDostępni] ${ok ? 'Potwierdzenie' : 'Kontrola'} defibrylatora AED „${displayName(a)}” na miejscu (${today}): ${lines}.${ok ? ` Można zaktualizować check_date=${today}.` : ' Wymaga sprawdzenia.'} #AEDostępni`;
    try { const prev = JSON.parse(localStorage.getItem(KEY) || '[]'); localStorage.setItem(KEY, JSON.stringify([{ aed: a.aed_uid, data: today, ...ans }, ...prev].slice(0, 200))); } catch { /* ignoruj */ }
    if (!osm) { setDone({}); return; }
    setBusy(true);
    try { setDone({ note: await createOsmNote(a.lat, a.lon, text, dev) }); }
    catch (e) { setDone({ err: (e as Error).message }); }
    setBusy(false);
  }

  if (done) {
    return (
      <div className="verify done" role="status">
        <b>Dziękujemy — to właśnie odświeża dane o AED.</b>
        {done.note && <span> Notatka #{done.note.id} jest w OpenStreetMap: <a href={done.note.url} target="_blank" rel="noopener">zobacz</a>.</span>}
        {done.err && <span> Nie udało się wysłać ({done.err}) — zapisaliśmy potwierdzenie na tym urządzeniu.</span>}
      </div>
    );
  }
  if (!open) {
    return <button className="btn verify-open" onClick={() => setOpen(true)}>✓ Jestem przy tym AED — potwierdź stan</button>;
  }
  const complete = Q.every((q) => ans[q.key]);
  return (
    <div className="verify">
      <b>Potwierdź stan AED</b>
      {Q.map((q) => (
        <fieldset key={q.key} className="verify-q">
          <legend>{q.label}</legend>
          <div className="verify-opts">
            {(Object.keys(LBL) as Ans[]).map((v) => (
              <label key={v} className={`verify-opt ${ans[q.key] === v ? 'on' : ''}`}>
                <input type="radio" name={`v-${q.key}`} value={v} checked={ans[q.key] === v} onChange={() => setAns({ ...ans, [q.key]: v })} />{LBL[v]}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <label className="consent"><input type="checkbox" checked={osm} onChange={(e) => setOsm(e.target.checked)} />
        <span>Wyślij anonimowo jako notatkę w OpenStreetMap, aby maperzy zaktualizowali datę kontroli.{dev && <b> (piaskownica OSM)</b>}</span>
      </label>
      <div className="btn-row">
        <button className="btn btn-primary" disabled={!complete || busy} onClick={send}>{busy ? 'Wysyłanie…' : 'Wyślij potwierdzenie'}</button>
        <button className="btn btn-ghost" onClick={() => setOpen(false)}>Anuluj</button>
      </div>
    </div>
  );
}
