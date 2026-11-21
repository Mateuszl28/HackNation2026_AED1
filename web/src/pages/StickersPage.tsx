import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { loadAeds, displayName, shortAddress } from '../data';
import { aedLink } from '../config';

export interface StickerItem { key: string; name: string; where: string; link: string; }
export const STICKERS_KEY = 'aedostepni-naklejki';

/** Naklejki „Tu jest AED” z kodem QR do karty AED (dostępność, nawigacja, zgłoszenie usterki). */
export default function StickersPage() {
  const [items, setItems] = useState<StickerItem[]>([]);
  const [fromValidator, setFromValidator] = useState(false);
  const [q, setQ] = useState('');
  const [qr, setQr] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STICKERS_KEY);
      if (raw) { setItems(JSON.parse(raw)); setFromValidator(true); }
    } catch { /* brak dostępu do sessionStorage */ }
  }, []);

  async function search() {
    const all = await loadAeds();
    const needle = q.trim().toLowerCase();
    if (needle.length < 3) return;
    const found = all.filter((a) => `${a.dysponent} ${a.miejscowosc} ${a.nazwa}`.toLowerCase().includes(needle)).slice(0, 48);
    setItems(found.map((a) => ({ key: a.aed_uid, name: displayName(a), where: a.opis_lokalizacji || shortAddress(a), link: aedLink(a.aed_uid) })));
    setFromValidator(false);
  }

  useEffect(() => {
    let alive = true;
    Promise.all(items.map(async (it) => [it.key, await QRCode.toDataURL(it.link, { margin: 1, width: 360, errorCorrectionLevel: 'M', color: { dark: '#0B2A3C', light: '#FFFFFF' } })] as const))
      .then((pairs) => { if (alive) setQr(Object.fromEntries(pairs)); });
    return () => { alive = false; };
  }, [items]);

  const pages = useMemo(() => { const p: StickerItem[][] = []; for (let i = 0; i < items.length; i += 6) p.push(items.slice(i, i + 6)); return p; }, [items]);

  return (
    <div className="page">
      <header className="page-head no-print">
        <p className="eyebrow">Dla dysponentów · do druku</p>
        <h1>Naklejki „Tu jest AED” z kodem QR</h1>
        <p className="lead">Naklej przy każdym AED. Kod QR otwiera kartę urządzenia w aplikacji: dostępność, nawigacja i przycisk „zgłoś usterkę”. Dzięki temu mieszkańcy pomagają utrzymać dane w dane.gov.pl aktualne.</p>
      </header>

      <section className="card no-print">
        {fromValidator
          ? <p>Naklejki dla <b>{items.length}</b> AED z pliku wgranego w walidatorze.</p>
          : <p>Wyszukaj AED w zbiorze krajowym po nazwie dysponenta, obiektu lub miejscowości.</p>}
        <form className="btn-row" onSubmit={(e) => { e.preventDefault(); search(); }}>
          <label className="field" style={{ flex: 1, minWidth: 220, margin: 0 }}>
            <span className="sr-only">Dysponent, obiekt lub miejscowość</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="np. Bydgoszcz, Poczta Polska, Urząd Miasta" />
          </label>
          <button className="btn" type="submit">Szukaj</button>
          <button className="btn btn-primary" type="button" onClick={() => window.print()} disabled={!items.length}>Drukuj / zapisz PDF</button>
        </form>
        {items.length > 0 && <p className="muted small">{items.length} naklejek · {pages.length} {pages.length === 1 ? 'arkusz' : 'arkusze'} A4 (6 na arkusz, ok. 9 × 9 cm)</p>}
      </section>

      <div className="sticker-sheets">
        {pages.map((p, i) => (
          <div className="sticker-sheet" key={i}>
            {p.map((it) => (
              <article className="sticker" key={it.key}>
                <header className="sticker-head">
                  <img src="./brand/aedostepni-symbol-white.svg" alt="" width="34" height="34" />
                  <div><b>Tu jest AED</b><small>Defibrylator — może go użyć każdy</small></div>
                </header>
                <div className="sticker-body">
                  {qr[it.key] ? <img className="sticker-qr" src={qr[it.key]} alt={`Kod QR: ${it.link}`} /> : <div className="sticker-qr" />}
                  <div className="sticker-text">
                    <p className="sticker-name">{it.name}</p>
                    {it.where && <p className="sticker-where">{it.where}</p>}
                    <p className="sticker-cta">Zeskanuj: dostępność, nawigacja, zgłoś usterkę</p>
                  </div>
                </div>
                <footer className="sticker-foot"><span>Nagły wypadek? Dzwoń <b>112</b></span><span>#AEDostępni</span></footer>
              </article>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
