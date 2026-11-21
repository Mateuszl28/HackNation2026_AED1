import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { FIELDS } from '@shared/schema.ts';
import { loadAeds, COUNTIES, displayName, shortAddress } from '../data';
import type { Aed } from '../data';

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
const MAX = 2000;

/** AED ze zbioru krajowego → rekord wzorcowego zakresu danych (puste pola zostają do uzupełnienia przez dysponenta). */
function toRecord(a: Aed): Record<string, string> {
  const known = (v: string, unknown: string) => (v && v !== unknown ? v : '');
  return {
    id: a.aed_uid, nazwa: displayName(a), szerokosc_geograficzna: String(a.lat), dlugosc_geograficzna: String(a.lon),
    opis_lokalizacji: a.opis_lokalizacji, kondygnacja: a.kondygnacja, wewnatrz_budynku: a.wewnatrz_budynku,
    cecha_ulicy: a.nazwa_ulicy ? 'ulica' : '', nazwa_ulicy: a.nazwa_ulicy, nr_budynku: a.nr_budynku, kod_pocztowy: a.kod_pocztowy,
    miejscowosc: a.miejscowosc, wojewodztwo: a.wojewodztwo, dostep: known(a.dostep, 'nieznany'), godziny_dostepnosci: a.godziny_dostepnosci,
    zabezpieczenie: known(a.zabezpieczenie, 'nieznane'), instrukcja_dostepu: a.instrukcja_dostepu, elektrody_dzieciece: a.elektrody_dzieciece,
    stan: known(a.stan, 'nieznany'), data_ostatniej_kontroli: a.data_ostatniej_kontroli, dysponent: a.dysponent,
    telefon_kontaktowy: a.telefon_kontaktowy, zdjecie_url: a.zdjecie_url,
  };
}

const GAPS: [keyof Aed, string][] = [['opis_lokalizacji', 'miejsce'], ['godziny_dostepnosci', 'godziny'], ['data_ostatniej_kontroli', 'kontrola'], ['dysponent', 'dysponent']];

export default function MyAeds({ onLoad }: { onLoad: (name: string, rows: Record<string, string>[]) => void }) {
  const [aeds, setAeds] = useState<Aed[]>([]);
  const [mode, setMode] = useState<'name' | 'county'>('name');
  const [q, setQ] = useState('');
  const [county, setCounty] = useState('');
  useEffect(() => { loadAeds().then(setAeds); }, []);

  const found = useMemo(() => {
    if (mode === 'county') return county ? aeds.filter((a) => a.powiat === county) : [];
    const words = fold(q).split(/\s+/).filter((w) => w.length >= 2);
    if (q.trim().length < 3) return [];
    return aeds.filter((a) => { const t = fold(`${a.dysponent} ${a.nazwa} ${a.miejscowosc} ${a.nazwa_ulicy}`); return words.every((w) => t.includes(w)); });
  }, [aeds, mode, q, county]);

  const pct = (k: keyof Aed) => (found.length ? Math.round((found.filter((a) => a[k]).length / found.length) * 100) : 0);
  const label = mode === 'county' ? county : q.trim();
  const slug = fold(label).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'aed';

  function downloadXlsx() {
    const cols = FIELDS.map((f) => f.name);
    const rows = found.slice(0, MAX).map(toRecord);
    const ws = XLSX.utils.json_to_sheet(rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] || '']))), { header: cols });
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'aed');
    const info = XLSX.utils.aoa_to_sheet([
      ['AEDostępni — plik wstępnie wypełniony danymi ze zbioru krajowego'],
      ['Uzupełnij puste kolumny (zwłaszcza: opis_lokalizacji, godziny_dostepnosci, zabezpieczenie, stan, data_ostatniej_kontroli, dysponent).'],
      ['Kolumnę id zastąp własnym, stałym identyfikatorem urządzenia. Usuń wiersze AED, które nie należą do Ciebie.'],
      ['Gotowy plik wgraj w walidatorze: https://mateuszl28.github.io/HackNation2026_AED1/#/dysponenci'],
      ['Źródło danych wstępnych: zbiór krajowy AEDostępni (dane.gov.pl + © współtwórcy OpenStreetMap, ODbL).'],
    ]);
    XLSX.utils.book_append_sheet(wb, info, 'instrukcja');
    const url = URL.createObjectURL(new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const el = document.createElement('a'); el.href = url; el.download = `aed-${slug}-do-uzupelnienia.xlsx`; el.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="card" aria-labelledby="my-aed">
      <h2 id="my-aed">Sprawdź, co już wiemy o Twoich AED</h2>
      <p className="muted small">Nie zaczynaj od pustego szablonu. Znajdź swoje urządzenia w zbiorze krajowym, pobierz je jako plik w standardzie i uzupełnij tylko brakujące informacje.</p>
      <div className="segmented" role="radiogroup" aria-label="Sposób wyszukiwania" style={{ margin: '4px 0 12px' }}>
        <button role="radio" aria-checked={mode === 'name'} className={mode === 'name' ? 'on' : ''} onClick={() => setMode('name')}>Po nazwie</button>
        <button role="radio" aria-checked={mode === 'county'} className={mode === 'county' ? 'on' : ''} onClick={() => setMode('county')}>Po powiecie</button>
      </div>
      {mode === 'name' ? (
        <label className="field">Nazwa dysponenta, obiektu lub miejscowości
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="np. Urząd Miasta Krosna, Poczta Polska, OSP" />
        </label>
      ) : (
        <label className="field">Powiat
          <select value={county} onChange={(e) => setCounty(e.target.value)}>
            <option value="">— wybierz powiat —</option>
            {COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      )}

      {label && (found.length === 0
        ? <p className="muted" role="status">Nie znaleźliśmy AED dla „{label}”. Zacznij od szablonu poniżej — i opublikuj swoje AED jako pierwszy.</p>
        : (
          <div role="status">
            <div className="kpis">
              <div className="kpi"><b>{found.length.toLocaleString('pl-PL')}</b><span>znanych AED</span></div>
              <div className={`kpi ${pct('godziny_dostepnosci') < 50 ? 'kpi-bad' : ''}`}><b>{pct('godziny_dostepnosci')}%</b><span>z godzinami</span></div>
              <div className={`kpi ${pct('data_ostatniej_kontroli') < 50 ? 'kpi-bad' : ''}`}><b>{pct('data_ostatniej_kontroli')}%</b><span>z datą kontroli</span></div>
              <div className={`kpi ${pct('opis_lokalizacji') < 50 ? 'kpi-bad' : ''}`}><b>{pct('opis_lokalizacji')}%</b><span>z opisem miejsca</span></div>
            </div>
            <ul className="my-aed-list">
              {found.slice(0, 8).map((a) => (
                <li key={a.aed_uid}>
                  <b>{displayName(a)}</b>
                  <span className="muted small">{[a.opis_lokalizacji, shortAddress(a)].filter(Boolean).join(' · ') || 'brak opisu i adresu'}</span>
                  <span className="gap-chips">{GAPS.filter(([k]) => !a[k]).map(([, l]) => <span key={l} className="badge badge-unknown">brak: {l}</span>)}</span>
                </li>
              ))}
            </ul>
            {found.length > 8 && <p className="muted small">…i {found.length - 8} więcej w pliku.</p>}
            <p className="btn-row">
              <button className="btn btn-primary" onClick={downloadXlsx}>Pobierz do uzupełnienia (XLSX){found.length > MAX ? ` — pierwsze ${MAX}` : ''}</button>
              <button className="btn" onClick={() => onLoad(`zbiór krajowy: ${label}`, found.slice(0, MAX).map(toRecord))}>Sprawdź w walidatorze</button>
            </p>
          </div>
        ))}
    </section>
  );
}
