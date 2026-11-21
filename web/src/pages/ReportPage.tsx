import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import { loadAeds, BYDGOSZCZ, sourceList, displayName } from '../data';
import { createOsmNote } from '../osmNotes';
import { watchFresh } from '../geo';
import type { OsmNote } from '../osmNotes';
import type { Aed } from '../data';
import { ACCESS_VALUES, SECURITY_VALUES } from '@shared/schema.ts';

interface Report { id: string; typ: string; aed_uid: string; nazwa: string; lat: string; lon: string; opis: string; godziny: string; dostep: string; zabezpieczenie: string; data: string; }

const PROBLEMS = [
  ['brak_aed', 'AED-a nie ma w tym miejscu'], ['zamkniety', 'AED zamknięty / niedostępny'], ['uszkodzony', 'AED uszkodzony / wskaźnik błędu'],
  ['zle_godziny', 'Błędne godziny dostępności'], ['zla_lokalizacja', 'Pinezka w złym miejscu'], ['inne', 'Inny problem z danymi'],
];
const KEY = 'aedostepni-zgloszenia';
function loadReports(): Report[] { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
function saveReports(r: Report[]) { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* tryb prywatny */ } }

export default function ReportPage() {
  const [params] = useSearchParams();
  const aedId = params.get('aed');
  const [aed, setAed] = useState<Aed | null>(null);
  const [mode, setMode] = useState<'nowy' | 'problem'>(aedId ? 'problem' : 'nowy');
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [list, setList] = useState<Report[]>(loadReports);
  const [sent, setSent] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<OsmNote | null>(null);
  const [noteErr, setNoteErr] = useState('');
  const osmDev = params.has('osmdev');
  const sources = aed ? sourceList(aed) : [];
  const dgp = sources.filter((s) => s.id.startsWith('dgp-'));
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const mk = useRef<L.Marker | null>(null);

  useEffect(() => { if (aedId) loadAeds().then((a) => setAed(a.find((x) => x.aed_uid === aedId) || null)); }, [aedId]);

  useEffect(() => {
    if (mode !== 'nowy' || !mapEl.current || mapRef.current) return;
    const m = L.map(mapEl.current).setView(BYDGOSZCZ, 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© współtwórcy OpenStreetMap' }).addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => setPos([e.latlng.lat, e.latlng.lng]));
    mapRef.current = m;
    return () => { m.remove(); mapRef.current = null; };
  }, [mode]);
  useEffect(() => {
    mk.current?.remove();
    if (pos && mapRef.current) mk.current = L.marker(pos, { icon: L.divIcon({ className: '', html: '<div class="pin pin-open"><span>+</span></div>', iconSize: [30, 38], iconAnchor: [15, 37] }) }).addTo(mapRef.current);
  }, [pos]);

  function myLocation() {
    // aktualna pozycja (natywny GPS w aplikacji); bierzemy pierwszy świeży odczyt z dokładnością ≤ 50 m albo najlepszy po 20 s
    let best = Infinity;
    const stop = watchFresh((f) => {
      if (f.acc >= best) return;
      best = f.acc;
      const c: [number, number] = [f.lat, f.lon]; setPos(c); mapRef.current?.setView(c, 18);
      if (f.acc <= 50) stop();
    }, () => stop());
    window.setTimeout(stop, 20000);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const r: Report = {
      id: crypto.randomUUID(), typ: mode === 'nowy' ? 'nowy_aed' : String(f.get('problem')), aed_uid: aed?.aed_uid || '',
      nazwa: String(f.get('nazwa') || (aed ? displayName(aed) : '')), lat: pos ? pos[0].toFixed(6) : String(aed?.lat ?? ''), lon: pos ? pos[1].toFixed(6) : String(aed?.lon ?? ''),
      opis: String(f.get('opis') || ''), godziny: String(f.get('godziny') || ''), dostep: String(f.get('dostep') || ''), zabezpieczenie: String(f.get('zabezpieczenie') || ''),
      data: new Date().toISOString(),
    };
    const publish = f.get('osm') === 'on' && r.lat && r.lon;
    setBusy(true); setNote(null); setNoteErr('');
    if (publish) {
      const label = PROBLEMS.find(([v]) => v === r.typ)?.[1];
      const text = r.typ === 'nowy_aed'
        ? `[AEDostępni] Brakujący defibrylator AED: ${r.nazwa}.${r.godziny ? ` Godziny: ${r.godziny}.` : ''}${r.dostep && r.dostep !== 'nieznany' ? ` Dostęp: ${r.dostep}.` : ''}${r.opis ? ` ${r.opis}` : ''} Proszę dodać emergency=defibrillator. #AEDostępni`
        : `[AEDostępni] Zgłoszenie dot. defibrylatora AED „${r.nazwa}”: ${label}.${r.opis ? ` ${r.opis}` : ''} (rekord ${r.aed_uid}) #AEDostępni`;
      try { setNote(await createOsmNote(Number(r.lat), Number(r.lon), text, osmDev)); }
      catch (err) { setNoteErr(`${(err as Error).message}. Zgłoszenie zapisaliśmy na tym urządzeniu — spróbuj ponownie później.`); }
    }
    const next = [r, ...list]; setList(next); saveReports(next);
    setSent('Dziękujemy! Zgłoszenie zapisane.');
    setBusy(false);
    form.reset(); setPos(null);
  }

  function exportCsv() {
    const cols: (keyof Report)[] = ['id', 'typ', 'aed_uid', 'nazwa', 'lat', 'lon', 'opis', 'godziny', 'dostep', 'zabezpieczenie', 'data'];
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = '﻿' + [cols.join(','), ...list.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'zgloszenia-aed.csv'; a.click();
  }

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Każdy może pomóc</p>
        <h1>Zgłoś AED lub błąd w danych</h1>
        <p className="lead">Brakuje AED na mapie albo szafka była zamknięta? Zgłoszenie trafi do dysponenta, który poprawi dane u źródła — w dane.gov.pl.</p>
      </header>

      <div className="segmented" role="radiogroup" aria-label="Rodzaj zgłoszenia">
        <button role="radio" aria-checked={mode === 'nowy'} className={mode === 'nowy' ? 'on' : ''} onClick={() => setMode('nowy')}>Nowy AED</button>
        <button role="radio" aria-checked={mode === 'problem'} className={mode === 'problem' ? 'on' : ''} onClick={() => setMode('problem')}>Problem z AED</button>
      </div>

      {sent && <p className="notice notice-ok" role="status">{sent}</p>}

      <form className="card form" onSubmit={submit}>
        {mode === 'problem' ? (
          <>
            {aed ? <p>Zgłaszasz problem z: <b>{aed.nazwa}</b> <span className="muted">({aed.aed_uid})</span></p>
              : <p className="muted">Wybierz AED na mapie i użyj przycisku „Zgłoś problem”, albo opisz miejsce poniżej.</p>}
            <fieldset>
              <legend>Co jest nie tak?</legend>
              {PROBLEMS.map(([v, l], i) => <label key={v} className="radio"><input type="radio" name="problem" value={v} required defaultChecked={i === 0} /> {l}</label>)}
            </fieldset>
            {!aed && <label className="field">Nazwa miejsca<input name="nazwa" required /></label>}
          </>
        ) : (
          <>
            <p id="maphelp">Kliknij na mapie miejsce, gdzie jest AED, albo użyj swojej lokalizacji.</p>
            <div ref={mapEl} className="mini-map" role="application" aria-describedby="maphelp" aria-label="Mapa do wskazania lokalizacji AED" />
            <p className="btn-row"><button type="button" className="btn btn-sm" onClick={myLocation}>Użyj mojej lokalizacji</button>
              {pos && <span className="muted">Wybrano: {pos[0].toFixed(5)}, {pos[1].toFixed(5)}</span>}</p>
            <label className="field">Nazwa miejsca / obiektu<input name="nazwa" required placeholder="np. Galeria Pomorska" /></label>
            <div className="grid-2">
              <label className="field">Godziny dostępności<input name="godziny" placeholder="np. 24/7 albo Mo-Sa 09:00-21:00" /></label>
              <label className="field">Kto ma dostęp
                <select name="dostep" defaultValue="nieznany">{ACCESS_VALUES.map((v) => <option key={v}>{v}</option>)}</select>
              </label>
            </div>
            <label className="field">Zabezpieczenie
              <select name="zabezpieczenie" defaultValue="nieznane">{SECURITY_VALUES.map((v) => <option key={v}>{v}</option>)}</select>
            </label>
          </>
        )}
        <label className="field">Opis (gdzie dokładnie, co zauważyłeś)<textarea name="opis" rows={3} placeholder="np. parter, przy wejściu od ul. Fordońskiej, obok bankomatu" /></label>
        <label className="consent">
          <input type="checkbox" name="osm" />
          <span><b>Opublikuj zgłoszenie jako notatkę w OpenStreetMap</b> — anonimowo, w miejscu AED. Wolontariusze-maperzy sprawdzą je i poprawią mapę, a poprawka trafi do zbioru krajowego. <i>Notatka jest publiczna: nie wpisuj danych osobowych.</i>{osmDev && <b> (tryb testowy: piaskownica OSM)</b>}</span>
        </label>
        <button className="btn btn-primary" type="submit" disabled={busy || (mode === 'nowy' && !pos)}>{busy ? 'Wysyłanie…' : 'Wyślij zgłoszenie'}</button>
        {mode === 'nowy' && !pos && <small className="muted">Najpierw wskaż miejsce na mapie.</small>}
      </form>

      {(note || noteErr || (sent && dgp.length > 0)) && (
        <section className="card" aria-live="polite">
          <h2>Gdzie trafiło zgłoszenie</h2>
          {note && <p className="notice notice-ok">✓ Notatka #{note.id} jest w OpenStreetMap: <a href={note.url} target="_blank" rel="noopener">zobacz na mapie</a>. Gdy maper ją rozwiąże, poprawka trafi do aplikacji przy najbliższej aktualizacji danych.</p>}
          {noteErr && <p className="notice notice-warn">{noteErr}</p>}
          {sent && dgp.length > 0 && (
            <p>Ten AED jest też w zbiorze dysponenta w dane.gov.pl. Przekaż uwagę bezpośrednio właścicielowi danych: {dgp.map((s) => <a key={s.id} className="btn btn-sm" style={{ marginLeft: 6 }} href={s.url} target="_blank" rel="noopener">{s.name.replace('dane.gov.pl — ', '')} w dane.gov.pl</a>)}</p>
          )}
        </section>
      )}

      {list.length > 0 && (
        <section className="card">
          <h2>Twoje zgłoszenia ({list.length})</h2>
          <ul className="issue-list">{list.slice(0, 10).map((r) => <li key={r.id}><b>{r.typ.replace(/_/g, ' ')}</b> — {r.nazwa} <span className="muted">{new Date(r.data).toLocaleString('pl-PL')}</span></li>)}</ul>
          <button className="btn btn-sm" onClick={exportCsv}>Eksportuj zgłoszenia (CSV)</button>
          <p className="muted"><small>Historia zgłoszeń jest zapisana na tym urządzeniu. Zgłoszenia opublikowane w OpenStreetMap są widoczne publicznie i trafiają do maperów.</small></p>
        </section>
      )}
    </div>
  );
}
