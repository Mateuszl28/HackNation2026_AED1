import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { PUBLIC_URL } from '../config';

const POSTS = [
  {
    title: 'Post — ogłoszenie akcji',
    text: 'Wiesz, gdzie jest najbliższy defibrylator AED? 🫀\nW nagłym zatrzymaniu krążenia każda minuta bez defibrylacji zmniejsza szanse na przeżycie. Dlatego dołączamy do akcji #AEDostępni i publikujemy dane o naszych AED na dane.gov.pl — żeby każdy mógł je znaleźć na mapie.\nUdostępnij dane. Daj komuś czas.',
  },
  {
    title: 'Post — wezwanie do instytucji',
    text: 'Masz AED w szkole, urzędzie, firmie lub sklepie? Opublikuj jego lokalizację i godziny dostępności w dane.gov.pl — to zajmuje 5 minut z walidatorem #AEDostępni.\nDane od właścicieli to dziś mniej niż 1% znanych AED w Polsce. Zmieńmy to.',
  },
  {
    title: 'Post — dla mieszkańców',
    text: 'Zobaczysz naklejkę „Tu jest AED” z kodem QR? Zeskanuj ją: sprawdzisz, czy AED jest dostępny i zgłosisz usterkę. Każde zgłoszenie poprawia dane dla wszystkich. #AEDostępni',
  },
];

const MAIL = `Temat: Prośba o udostępnienie danych o defibrylatorach AED — akcja AEDostępni

Szanowni Państwo,

w ramach akcji AEDostępni zbieramy w portalu dane.gov.pl dane o lokalizacji i dostępności defibrylatorów AED. Dzięki nim świadek nagłego zatrzymania krążenia szybciej znajdzie najbliższe dostępne urządzenie.

Prosimy o opublikowanie wykazu AED, którymi Państwo dysponują, zgodnie z wzorcowym zakresem danych. Najprościej skorzystać z bezpłatnego walidatora:
${PUBLIC_URL}#/dysponenci
— wystarczy wgrać dowolny plik (CSV/XLSX), a narzędzie przygotuje dane i metadane do publikacji.

Najważniejsze informacje to: dokładne miejsce zawieszenia AED, godziny dostępności, sposób zabezpieczenia oraz data ostatniej kontroli.

Z poważaniem`;

export default function CampaignPage() {
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState('');
  useEffect(() => { QRCode.toDataURL(PUBLIC_URL, { margin: 1, width: 480, color: { dark: '#0B2A3C', light: '#FFFFFF' } }).then(setQr); }, []);

  async function copy(key: string, text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 2000); } catch { /* brak schowka */ }
  }
  function printPoster() {
    document.body.classList.add('print-poster');
    const off = () => { document.body.classList.remove('print-poster'); window.removeEventListener('afterprint', off); };
    window.addEventListener('afterprint', off);
    window.print();
  }

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Zestaw kampanii #AEDostępni</p>
        <h1>Materiały do pobrania i udostępnienia</h1>
        <p className="lead">Wszystko, czego gmina, szpital czy firma potrzebuje, żeby włączyć się w akcję: plakat, gotowe posty, szablon pisma i znak graficzny.</p>
      </header>

      <section className="card campaign-grid">
        <div>
          <h2>Plakat A4</h2>
          <p className="muted">Do powieszenia przy wejściu, w pokoju nauczycielskim albo w urzędzie. Kod QR prowadzi do mapy AED.</p>
          <p className="btn-row"><button className="btn btn-primary" onClick={printPoster}>Drukuj / zapisz PDF</button></p>
        </div>
        <div className="poster" aria-label="Podgląd plakatu">
          <img className="poster-logo" src="./brand/aedostepni-logo-vertical.svg" alt="AEDostępni — Udostępnij dane. Daj komuś czas." />
          <p className="poster-q">Wiesz, gdzie jest najbliższy defibrylator?</p>
          <p className="poster-a">Przy nagłym zatrzymaniu krążenia liczy się każda minuta. AED może użyć każdy — trzeba tylko wiedzieć, gdzie go szukać.</p>
          <div className="poster-qr-row">
            {qr && <img src={qr} alt={`Kod QR do mapy AED: ${PUBLIC_URL}`} />}
            <div><b>Zeskanuj i sprawdź mapę AED</b><span>Masz AED? Udostępnij dane w dane.gov.pl</span></div>
          </div>
          <p className="poster-foot">Nagły wypadek — dzwoń <b>112</b> · #AEDostępni</p>
        </div>
      </section>

      <section className="card">
        <h2>Gotowe posty do mediów społecznościowych</h2>
        <div className="posts">
          {POSTS.map((p) => (
            <article className="post" key={p.title}>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
              <button className="btn btn-sm" onClick={() => copy(p.title, `${p.text}\n${PUBLIC_URL}`)}>{copied === p.title ? 'Skopiowano ✓' : 'Kopiuj tekst'}</button>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Pismo do dysponentów AED</h2>
        <p className="muted">Dla gmin i urzędów, które chcą zebrać dane od szkół, jednostek i firm na swoim terenie.</p>
        <pre className="mail" tabIndex={0} aria-label="Treść pisma do dysponentów">{MAIL}</pre>
        <button className="btn" onClick={() => copy('mail', MAIL)}>{copied === 'mail' ? 'Skopiowano ✓' : 'Kopiuj treść pisma'}</button>
      </section>

      <section className="card">
        <h2>Znak graficzny</h2>
        <div className="brand-tiles">
          <a className="brand-tile" href="./brand/aedostepni-logo.svg" download><img src="./brand/aedostepni-logo.svg" alt="" /><span>Logo poziome (SVG)</span></a>
          <a className="brand-tile" href="./brand/aedostepni-logo-slogan.svg" download><img src="./brand/aedostepni-logo-slogan.svg" alt="" /><span>Logo z hasłem (SVG)</span></a>
          <a className="brand-tile dark" href="./brand/aedostepni-logo-white.svg" download><img src="./brand/aedostepni-logo-white.svg" alt="" /><span>Negatyw (SVG)</span></a>
          <a className="brand-tile" href="./brand/aedostepni-symbol.svg" download><img src="./brand/aedostepni-symbol.svg" alt="" /><span>Sygnet (SVG)</span></a>
        </div>
        <p className="btn-row"><a className="btn btn-primary" href="./brand/ksiega-znaku.pdf" target="_blank" rel="noopener">Księga znaku (PDF)</a> <a className="btn" href="#/naklejki">Naklejki QR dla AED</a> <a className="btn" href="#/raport">Raport dla samorządu</a></p>
      </section>
    </div>
  );
}
