import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { loadAeds, COUNTIES, displayName, shortAddress } from '../data';
import type { Aed } from '../data';
import { PUBLIC_URL } from '../config';

interface CountyRow { id: string; powiat: string; wojewodztwo: string; aed: number; indeks_gotowosci: number; }
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const today = new Date().toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

/** Raport „Stan danych o AED w powiecie” — do druku / PDF, dla starostw, gmin i radnych. */
export default function ReportCountyPage() {
  const { county = '' } = useParams();
  const label = decodeURIComponent(county);
  const navigate = useNavigate();
  const [aeds, setAeds] = useState<Aed[]>([]);
  const [rank, setRank] = useState<{ pos: number; of: number; row?: CountyRow } | null>(null);
  const [qr, setQr] = useState('');

  useEffect(() => { loadAeds().then(setAeds); }, []);
  useEffect(() => {
    if (!label) return;
    fetch('./data/powiaty.json').then((r) => r.json()).then((d: { powiaty: CountyRow[] }) => {
      const list = [...d.powiaty].sort((a, b) => b.indeks_gotowosci - a.indeks_gotowosci);
      const i = list.findIndex((p) => `${p.powiat} (${p.wojewodztwo})` === label);
      setRank(i >= 0 ? { pos: i + 1, of: list.length, row: list[i] } : { pos: 0, of: list.length });
    });
    QRCode.toDataURL(`${PUBLIC_URL}#/dysponenci`, { margin: 1, width: 300, color: { dark: '#0B2A3C', light: '#FFFFFF' } }).then(setQr);
  }, [label]);

  const mine = useMemo(() => aeds.filter((a) => a.powiat === label), [aeds, label]);
  const s = useMemo(() => {
    const n = mine.length;
    return {
      n,
      godz: pct(mine.filter((a) => a.godziny_dostepnosci).length, n),
      kontr: pct(mine.filter((a) => a.data_ostatniej_kontroli).length, n),
      opis: pct(mine.filter((a) => a.opis_lokalizacji).length, n),
      dysp: mine.filter((a) => /(^|\|)dgp-/.test(a.zrodla)).length,
      h247: mine.filter((a) => a.godziny_dostepnosci === '24/7').length,
    };
  }, [mine]);
  const gaps = mine.filter((a) => !a.godziny_dostepnosci || !a.data_ostatniej_kontroli || !a.opis_lokalizacji).slice(0, 25);

  if (!label) {
    return (
      <div className="page">
        <header className="page-head"><p className="eyebrow">Raport dla samorządu</p><h1>Stan danych o AED w powiecie</h1>
          <p className="lead">Wybierz powiat — przygotujemy raport do wydruku lub zapisania jako PDF.</p></header>
        <section className="card">
          <label className="field">Powiat
            <select defaultValue="" onChange={(e) => e.target.value && navigate(`/raport/${encodeURIComponent(e.target.value)}`)}>
              <option value="">— wybierz powiat —</option>
              {COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          {COUNTIES.length === 0 && <p className="muted" role="status">Wczytywanie listy powiatów…</p>}
        </section>
      </div>
    );
  }

  return (
    <div className="page report-county">
      <div className="no-print btn-row" style={{ margin: '16px 0' }}>
        <button className="btn btn-primary" onClick={() => window.print()}>Drukuj / zapisz PDF</button>
        <button className="btn" onClick={() => navigate('/raport')}>Inny powiat</button>
      </div>
      <article className="rc-sheet">
        <header className="rc-head">
          <img src="./brand/aedostepni-logo.svg" alt="AEDostępni" />
          <div><b>Stan danych o defibrylatorach AED</b><span>{label} · stan na {today}</span></div>
        </header>

        <section className="rc-kpis" aria-label="Najważniejsze liczby">
          <div><b>{s.n}</b><span>znanych AED</span></div>
          <div className={s.godz < 50 ? 'bad' : ''}><b>{s.godz}%</b><span>z godzinami dostępności</span></div>
          <div className={s.kontr < 50 ? 'bad' : ''}><b>{s.kontr}%</b><span>z datą kontroli</span></div>
          <div className={s.dysp === 0 ? 'bad' : ''}><b>{s.dysp}</b><span>z danych właścicieli (dane.gov.pl)</span></div>
        </section>

        <p className="rc-lead">
          {rank && rank.pos > 0 && <>W rankingu gotowości danych powiat zajmuje <b>{rank.pos}. miejsce na {rank.of}</b> (indeks {rank.row?.indeks_gotowosci}/100). </>}
          {s.dysp === 0
            ? <>Żaden właściciel AED w tym powiecie nie publikuje jeszcze danych w portalu dane.gov.pl — wszystkie informacje pochodzą z mapy społecznościowej OpenStreetMap.</>
            : <>{s.dysp} AED jest potwierdzonych w zbiorach właścicieli w dane.gov.pl.</>}
          {' '}Całodobowo dostępnych jest {s.h247} z {s.n} urządzeń.
        </p>

        <h2>Dlaczego to ważne</h2>
        <p>Przy nagłym zatrzymaniu krążenia każda minuta bez defibrylacji zmniejsza szanse przeżycia. Świadek zdarzenia musi wiedzieć, <b>gdzie jest najbliższy AED, czy jest dostępny teraz i czy działa</b>. Te informacje ma tylko właściciel urządzenia.</p>

        <h2>Co możemy zrobić razem</h2>
        <ol>
          <li>Zebrać wykaz AED w jednostkach samorządu: urzędy, szkoły, OSP, pływalnie, ośrodki kultury i sportu.</li>
          <li>Opublikować go w dane.gov.pl za pomocą bezpłatnego walidatora AEDostępni — zajmuje to kilka minut.</li>
          <li>Oznaczyć urządzenia naklejkami z kodem QR i zachęcić firmy, szpitale i przewoźników do tego samego.</li>
        </ol>

        {gaps.length > 0 && (
          <>
            <h2>AED do uzupełnienia ({mine.filter((a) => !a.godziny_dostepnosci || !a.data_ostatniej_kontroli || !a.opis_lokalizacji).length})</h2>
            <table className="rc-table">
              <thead><tr><th>AED</th><th>Brakuje</th></tr></thead>
              <tbody>
                {gaps.map((a) => (
                  <tr key={a.aed_uid}>
                    <td><b>{displayName(a)}</b><br /><small>{shortAddress(a) || a.opis_lokalizacji || `${a.lat.toFixed(5)}, ${a.lon.toFixed(5)}`}</small></td>
                    <td>{[!a.godziny_dostepnosci && 'godziny', !a.data_ostatniej_kontroli && 'data kontroli', !a.opis_lokalizacji && 'opis miejsca'].filter(Boolean).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {mine.length > gaps.length && <p className="rc-small">Pełna lista: zakładka „Dla dysponentów” → „Sprawdź, co już wiemy o Twoich AED” → wybierz powiat.</p>}
          </>
        )}

        <footer className="rc-foot">
          {qr && <img src={qr} alt={`Kod QR do walidatora AEDostępni: ${PUBLIC_URL}#/dysponenci`} />}
          <div><b>Udostępnij dane. Daj komuś czas.</b><span>Walidator i instrukcja: {PUBLIC_URL.replace('https://', '')}#/dysponenci</span><span>#AEDostępni · źródła: dane.gov.pl, © współtwórcy OpenStreetMap (ODbL)</span></div>
        </footer>
      </article>
    </div>
  );
}
