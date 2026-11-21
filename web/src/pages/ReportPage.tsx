import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import { loadAeds, BYDGOSZCZ } from '../data';
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
    navigator.geolocation?.getCurrentPosition((p) => { const c: [number, number] = [p.coords.latitude, p.coords.longitude]; setPos(c); mapRef.current?.setView(c, 18); });
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r: Report = {
      id: crypto.randomUUID(), typ: mode === 'nowy' ? 'nowy_aed' : String(f.get('problem')), aed_uid: aed?.aed_uid || '',
      nazwa: String(f.get('nazwa') || aed?.nazwa || ''), lat: pos ? pos[0].toFixed(6) : String(aed?.lat ?? ''), lon: pos ? pos[1].toFixed(6) : String(aed?.lon ?? ''),
      opis: String(f.get('opis') || ''), godziny: String(f.get('godziny') || ''), dostep: String(f.get('dostep') || ''), zabezpieczenie: String(f.get('zabezpieczenie') || ''),
      data: new Date().toISOString(),
    };
    const next = [r, ...list]; setList(next); saveReports(next);
    setSent('Dziękujemy! Zgłoszenie trafi do weryfikacji przez dysponenta lub gminę, a po potwierdzeniu do zbioru na dane.gov.pl.');
    e.currentTarget.reset(); setPos(null);
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
        <p className="lead">Widzisz AED, którego nie ma na mapie? Szafka była zamknięta? Twoje zgłoszenie trafia do dysponenta urządzenia, który poprawia dane u źródła, czyli w swoim zbiorze na dane.gov.pl.</p>
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
        <button className="btn btn-primary" type="submit" disabled={mode === 'nowy' && !pos}>Wyślij zgłoszenie</button>
        {mode === 'nowy' && !pos && <small className="muted">Najpierw wskaż miejsce na mapie.</small>}
      </form>

      {list.length > 0 && (
        <section className="card">
          <h2>Twoje zgłoszenia ({list.length})</h2>
          <ul className="issue-list">{list.slice(0, 10).map((r) => <li key={r.id}><b>{r.typ.replace(/_/g, ' ')}</b> — {r.nazwa} <span className="muted">{new Date(r.data).toLocaleString('pl-PL')}</span></li>)}</ul>
          <button className="btn btn-sm" onClick={exportCsv}>Eksportuj zgłoszenia (CSV)</button>
          <p className="muted"><small>Prototyp: zgłoszenia są przechowywane na tym urządzeniu. W wersji produkcyjnej trafiają do kolejki weryfikacji dysponenta (patrz „O akcji”).</small></p>
        </section>
      )}
    </div>
  );
}
