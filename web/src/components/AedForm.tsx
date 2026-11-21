import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { describeHours, rulesToOpeningHours } from '@shared/hours.ts';
import type { HoursRule as Rule } from '@shared/hours.ts';
import { ACCESS_LABEL, SECURITY_LABEL, BYDGOSZCZ } from '../data';
import { reverseParts } from '../geocode';
import { watchFresh, getManualFix } from '../geo';

type Rec = Record<string, string>;
const DAY_PL = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];
const DRAFT_KEY = 'aedostepni-formularz-v1';

const EMPTY_AED = { nazwa: '', opis_lokalizacji: '', kondygnacja: '', wewnatrz_budynku: 'tak', nazwa_ulicy: '', nr_budynku: '', kod_pocztowy: '', miejscowosc: '',
  dostep: 'publiczny', zabezpieczenie: 'szafka_z_alarmem', instrukcja_dostepu: '', elektrody_dzieciece: '', stan: 'sprawny',
  data_ostatniej_kontroli: '', data_waznosci_elektrod: '', data_waznosci_baterii: '' };

/** Formularz dla dysponentów z kilkoma AED: bez arkusza, wynik trafia do walidatora i eksportu. */
export default function AedForm({ onLoad }: { onLoad: (name: string, rows: Rec[]) => void }) {
  const [open, setOpen] = useState(false);
  const [owner, setOwner] = useState({ dysponent: '', dysponent_regon: '', telefon_kontaktowy: '' });
  const [aed, setAed] = useState<Rec>({ ...EMPTY_AED });
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [always, setAlways] = useState(false);
  const [rules, setRules] = useState<Rule[]>([{ days: [true, true, true, true, true, false, false], from: '08:00', to: '16:00' }]);
  const [list, setList] = useState<Rec[]>([]);
  const [msg, setMsg] = useState('');
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // szkic zapisany na urządzeniu — odświeżenie strony nie kasuje wpisanych AED
  useEffect(() => {
    try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); if (d) { setOwner(d.owner); setList(d.list || []); } } catch { /* brak szkicu */ }
  }, []);
  useEffect(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ owner, list })); } catch { /* ignoruj */ } }, [owner, list]);

  const hours = rulesToOpeningHours(rules, always);
  const hoursText = useMemo(() => (hours ? describeHours(hours) : ''), [hours]);

  useEffect(() => {
    if (!open || !mapEl.current || mapRef.current) return;
    const m = getManualFix();
    const map = L.map(mapEl.current).setView(m ? [m.lat, m.lon] : BYDGOSZCZ, m ? 17 : 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© współtwórcy OpenStreetMap' }).addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => place(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
  }, [open]);

  function place(lat: number, lon: number, zoom = false) {
    const map = mapRef.current; if (!map) return;
    setPos([lat, lon]);
    if (!markerRef.current) {
      markerRef.current = L.marker([lat, lon], { draggable: true, title: 'AED — przeciągnij, aby poprawić' }).addTo(map);
      markerRef.current.on('dragend', () => { const p = markerRef.current!.getLatLng(); place(p.lat, p.lng); });
    } else markerRef.current.setLatLng([lat, lon]);
    if (zoom) map.setView([lat, lon], 18);
    // podpowiedź adresu (tylko puste pola — nie nadpisujemy tego, co wpisał użytkownik)
    reverseParts(lat, lon).then((p) => {
      setAed((a) => ({ ...a, nazwa_ulicy: a.nazwa_ulicy || p.street, nr_budynku: a.nr_budynku || p.house, kod_pocztowy: a.kod_pocztowy || p.postcode, miejscowosc: a.miejscowosc || p.city }));
    }).catch(() => {});
  }
  function useMyLocation() {
    setMsg('Ustalam lokalizację…');
    let done = false;
    const stop = watchFresh((f) => { if (done) return; done = true; stop(); setMsg(f.acc > 50 ? `Lokalizacja przybliżona (±${f.acc} m) — popraw pinezkę.` : ''); place(f.lat, f.lon, true); },
      () => { if (!done) setMsg('Nie udało się ustalić lokalizacji — kliknij na mapie.'); });
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setAed((a) => ({ ...a, [k]: e.target.value }));
  const missing = [!pos && 'miejsce na mapie', !aed.nazwa && 'nazwa obiektu', !aed.opis_lokalizacji && 'gdzie dokładnie wisi AED', !aed.nr_budynku && 'nr budynku', !/^\d{2}-\d{3}$/.test(aed.kod_pocztowy) && 'kod pocztowy (00-000)', !aed.miejscowosc && 'miejscowość', !hours && 'godziny dostępności', !owner.dysponent && 'dysponent'].filter(Boolean) as string[];

  function add() {
    if (missing.length) { setMsg(`Uzupełnij: ${missing.join(', ')}.`); return; }
    const rec: Rec = {
      ...aed, ...owner, id: `AED-${list.length + 1}`, godziny_dostepnosci: hours,
      szerokosc_geograficzna: pos![0].toFixed(6), dlugosc_geograficzna: pos![1].toFixed(6), cecha_ulicy: aed.nazwa_ulicy ? 'ulica' : '',
      data_aktualizacji: new Date().toISOString().slice(0, 10),
    };
    setList((l) => [...l, rec]);
    setAed({ ...EMPTY_AED, miejscowosc: aed.miejscowosc });
    setPos(null); markerRef.current?.remove(); markerRef.current = null;
    setMsg(`Dodano AED „${rec.nazwa}”. Możesz dodać kolejny albo przejść do sprawdzenia i pobrania plików.`);
  }

  if (!open) {
    return (
      <section className="card form-cta">
        <div><h2>Masz kilka AED i żadnego arkusza?</h2><p className="muted">Wypełnij krótki formularz — zaznacz AED na mapie, wybierz godziny i pobierz gotowe pliki do dane.gov.pl.</p></div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>Wypełnij formularz online</button>
      </section>
    );
  }

  return (
    <section className="card aed-form" aria-labelledby="af-h">
      <h2 id="af-h">Formularz AED</h2>
      <fieldset>
        <legend>Dysponent (wspólny dla wszystkich AED)</legend>
        <div className="form-grid">
          <label className="field">Nazwa instytucji / firmy *<input value={owner.dysponent} onChange={(e) => setOwner({ ...owner, dysponent: e.target.value })} placeholder="np. Urząd Gminy Białe Błota" /></label>
          <label className="field">REGON<input value={owner.dysponent_regon} onChange={(e) => setOwner({ ...owner, dysponent_regon: e.target.value.replace(/\D/g, '') })} inputMode="numeric" maxLength={14} /></label>
          <label className="field">Telefon kontaktowy<input value={owner.telefon_kontaktowy} onChange={(e) => setOwner({ ...owner, telefon_kontaktowy: e.target.value })} inputMode="tel" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>AED nr {list.length + 1}</legend>
        <p className="muted small">Kliknij na mapie miejsce, gdzie wisi AED (pinezkę można przeciągnąć).</p>
        <div className="btn-row"><button type="button" className="btn" onClick={useMyLocation}>📍 Jestem przy tym AED</button></div>
        <div ref={mapEl} className="af-map" role="application" aria-label="Mapa: wskaż miejsce AED" />
        {pos && <p className="muted small">Współrzędne: {pos[0].toFixed(6)}, {pos[1].toFixed(6)}</p>}
        <div className="form-grid">
          <label className="field">Nazwa obiektu *<input value={aed.nazwa} onChange={set('nazwa')} placeholder="np. Szkoła Podstawowa nr 3" /></label>
          <label className="field">Gdzie dokładnie wisi AED? *<input value={aed.opis_lokalizacji} onChange={set('opis_lokalizacji')} placeholder="np. hol główny, przy portierni" /></label>
          <label className="field">Ulica (jeśli jest)<input value={aed.nazwa_ulicy} onChange={set('nazwa_ulicy')} /></label>
          <label className="field">Nr budynku *<input value={aed.nr_budynku} onChange={set('nr_budynku')} /></label>
          <label className="field">Kod pocztowy *<input value={aed.kod_pocztowy} onChange={set('kod_pocztowy')} placeholder="00-000" /></label>
          <label className="field">Miejscowość *<input value={aed.miejscowosc} onChange={set('miejscowosc')} /></label>
          <label className="field">W budynku?<select value={aed.wewnatrz_budynku} onChange={set('wewnatrz_budynku')}><option value="tak">tak, wewnątrz</option><option value="nie">nie, na zewnątrz</option></select></label>
          <label className="field">Piętro<input value={aed.kondygnacja} onChange={set('kondygnacja')} placeholder="0 = parter" inputMode="numeric" /></label>
        </div>

        <div className="af-hours">
          <b>Kiedy AED jest dostępny? *</b>
          <label className="af-check"><input type="checkbox" checked={always} onChange={(e) => setAlways(e.target.checked)} /> Całodobowo, 7 dni w tygodniu</label>
          {!always && rules.map((r, ri) => (
            <div key={ri} className="af-rule">
              <div className="af-days" role="group" aria-label={`Dni, reguła ${ri + 1}`}>
                {DAY_PL.map((d, di) => (
                  <button type="button" key={d} aria-pressed={r.days[di]} className={r.days[di] ? 'on' : ''}
                    onClick={() => setRules(rules.map((x, i) => (i === ri ? { ...x, days: x.days.map((v, k) => (k === di ? !v : v)) } : x)))}>{d}</button>
                ))}
              </div>
              <label>od <input type="time" value={r.from} onChange={(e) => setRules(rules.map((x, i) => (i === ri ? { ...x, from: e.target.value } : x)))} /></label>
              <label>do <input type="time" value={r.to} onChange={(e) => setRules(rules.map((x, i) => (i === ri ? { ...x, to: e.target.value } : x)))} /></label>
              {rules.length > 1 && <button type="button" className="btn btn-ghost" onClick={() => setRules(rules.filter((_, i) => i !== ri))} aria-label="Usuń regułę">✕</button>}
            </div>
          ))}
          {!always && <button type="button" className="btn btn-ghost" onClick={() => setRules([...rules, { days: [false, false, false, false, false, true, false], from: '09:00', to: '13:00' }])}>+ inne godziny w inne dni</button>}
          {hours && <p className="muted small">Zapis w standardzie: <code>{hours}</code>{hoursText && <> — {hoursText}</>}</p>}
        </div>

        <div className="form-grid">
          <label className="field">Kto ma dostęp?<select value={aed.dostep} onChange={set('dostep')}>{Object.entries(ACCESS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="field">Zabezpieczenie<select value={aed.zabezpieczenie} onChange={set('zabezpieczenie')}>{Object.entries(SECURITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="field">Stan<select value={aed.stan} onChange={set('stan')}><option value="sprawny">sprawny</option><option value="w_serwisie">w serwisie</option><option value="niesprawny">niesprawny</option></select></label>
          <label className="field">Elektrody dziecięce<select value={aed.elektrody_dzieciece} onChange={set('elektrody_dzieciece')}><option value="">nie wiem</option><option value="tak">tak</option><option value="nie">nie</option></select></label>
          <label className="field">Data ostatniej kontroli<input type="date" value={aed.data_ostatniej_kontroli} onChange={set('data_ostatniej_kontroli')} /></label>
          <label className="field">Elektrody ważne do<input type="date" value={aed.data_waznosci_elektrod} onChange={set('data_waznosci_elektrod')} /></label>
          <label className="field">Bateria ważna do<input type="date" value={aed.data_waznosci_baterii} onChange={set('data_waznosci_baterii')} /></label>
          <label className="field">Jak dostać się do AED? (np. kod szafki u dyspozytora)<input value={aed.instrukcja_dostepu} onChange={set('instrukcja_dostepu')} /></label>
        </div>
      </fieldset>

      {msg && <p className="notice notice-info" role="status">{msg}</p>}
      <div className="btn-row">
        <button type="button" className="btn" onClick={add}>+ Dodaj ten AED do listy</button>
        <button type="button" className="btn btn-primary" disabled={!list.length} onClick={() => onLoad(`formularz (${list.length} AED)`, list)}>Sprawdź i pobierz pliki ({list.length})</button>
      </div>
      {list.length > 0 && (
        <ul className="af-list">
          {list.map((r, i) => (
            <li key={r.id}><b>{r.nazwa}</b> — {r.opis_lokalizacji} · <code>{r.godziny_dostepnosci}</code>
              <button type="button" className="btn btn-ghost" onClick={() => setList(list.filter((_, k) => k !== i).map((x, k) => ({ ...x, id: `AED-${k + 1}` })))} aria-label={`Usuń ${r.nazwa}`}>Usuń</button></li>
          ))}
        </ul>
      )}
    </section>
  );
}
