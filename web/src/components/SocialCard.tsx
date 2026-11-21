import { useEffect, useRef, useState } from 'react';

export interface CardStats { title: string; subtitle: string; big: string; bigLabel: string; items: { v: string; l: string; bad?: boolean }[]; }

const W = 1080, H = 1080;
const GREEN = '#007A3D', NAVY = '#0B2A3C', RED = '#D7262E', MINT = '#E6F4EC';

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' '); const lines: string[] = []; let cur = '';
  for (const w of words) { const t = cur ? `${cur} ${w}` : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  return lines;
}
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** Rysuje grafikę 1080×1080 do mediów społecznościowych (canvas, bez serwera). */
async function draw(canvas: HTMLCanvasElement, s: CardStats) {
  const ctx = canvas.getContext('2d')!;
  await document.fonts?.ready;
  const font = (w: number, px: number) => `${w} ${px}px Manrope, "Segoe UI", Arial, sans-serif`;
  // tło
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#00904F'); g.addColorStop(1, '#005C2E');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // karta
  ctx.fillStyle = '#FFFFFF'; rr(ctx, 60, 60, W - 120, H - 230, 40); ctx.fill();
  // logo
  const logo = new Image(); logo.src = './brand/aedostepni-logo.svg';
  await new Promise((res) => { logo.onload = res; logo.onerror = res; });
  if (logo.naturalWidth) { const lw = 420, lh = lw * (logo.naturalHeight / logo.naturalWidth); ctx.drawImage(logo, 110, 110, lw, lh); }
  // tytuł
  ctx.fillStyle = NAVY; ctx.font = font(800, 54);
  const tl = wrap(ctx, s.title, W - 220); tl.slice(0, 2).forEach((l, i) => ctx.fillText(l, 110, 290 + i * 62));
  const y0 = 290 + Math.min(tl.length, 2) * 62;
  ctx.fillStyle = '#51606B'; ctx.font = font(600, 30); ctx.fillText(s.subtitle, 110, y0 + 4);
  // duża liczba
  ctx.fillStyle = RED; ctx.font = font(800, 170); ctx.fillText(s.big, 104, y0 + 190);
  ctx.fillStyle = NAVY; ctx.font = font(700, 36);
  wrap(ctx, s.bigLabel, W - 220).slice(0, 2).forEach((l, i) => ctx.fillText(l, 110, y0 + 245 + i * 44));
  // kafelki
  const ty = y0 + 340, tw = (W - 220 - 2 * 24) / 3;
  s.items.slice(0, 3).forEach((it, i) => {
    const x = 110 + i * (tw + 24);
    ctx.fillStyle = it.bad ? '#FDECEC' : MINT; rr(ctx, x, ty, tw, 150, 24); ctx.fill();
    ctx.fillStyle = it.bad ? '#B01C23' : GREEN; ctx.font = font(800, 56); ctx.fillText(it.v, x + 24, ty + 72);
    ctx.fillStyle = '#51606B'; ctx.font = font(600, 24); wrap(ctx, it.l, tw - 40).slice(0, 2).forEach((l, k) => ctx.fillText(l, x + 24, ty + 108 + k * 28));
  });
  // stopka na zielonym
  ctx.fillStyle = '#FFFFFF'; ctx.font = font(800, 44); ctx.fillText('Udostępnij dane. Daj komuś czas.', 80, H - 95);
  ctx.font = font(600, 28); ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fillText('#AEDostępni · mateuszl28.github.io/HackNation2026_AED1', 80, H - 50);
}

export default function SocialCard({ stats, fileName }: { stats: CardStats; fileName: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!ref.current) return;
    draw(ref.current, stats).then(() => setUrl(ref.current!.toDataURL('image/png')));
  }, [JSON.stringify(stats)]);

  async function share() {
    const c = ref.current; if (!c) return;
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, 'image/png'));
    if (!blob) return;
    const file = new File([blob], `${fileName}.png`, { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    try {
      if (nav.share && nav.canShare?.({ files: [file] })) { await nav.share({ files: [file], title: stats.title, text: `${stats.title} #AEDostępni` }); return; }
    } catch { return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  }

  return (
    <div className="social-card">
      <canvas ref={ref} width={W} height={H} className="social-canvas" role="img" aria-label={`Grafika: ${stats.title}. ${stats.big} ${stats.bigLabel}`} />
      <div className="btn-row">
        <button className="btn btn-primary" onClick={share} disabled={!url}>Udostępnij grafikę</button>
        {url && <a className="btn" href={url} download={`${fileName}.png`}>Pobierz PNG</a>}
      </div>
    </div>
  );
}
