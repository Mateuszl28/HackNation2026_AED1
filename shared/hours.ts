// Minimalny interpreter składni opening_hours (podzbiór wystarczający dla AED).
// Zwraca true/false, lub null gdy reguły nie da się jednoznacznie zinterpretować.

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
export const DAY_PL: Record<string, string> = { Mo: 'pn', Tu: 'wt', We: 'śr', Th: 'czw', Fr: 'pt', Sa: 'sob', Su: 'nd', PH: 'święta' };

function dayIndex(d: Date): number { return (d.getDay() + 6) % 7; } // pn = 0

function parseDays(spec: string): Set<number> | null {
  const out = new Set<number>();
  for (const part of spec.split(',')) {
    const p = part.trim();
    if (p === 'PH' || p === 'SH') continue;
    const m = p.match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/);
    if (!m) return null;
    const a = DAYS.indexOf(m[1]);
    const b = m[2] ? DAYS.indexOf(m[2]) : a;
    for (let i = a; ; i = (i + 1) % 7) { out.add(i); if (i === b) break; }
  }
  return out;
}

function toMin(t: string): number { const [h, m] = t.split(':').map(Number); return h * 60 + m; }

export function isOpenAt(oh: string | undefined, when: Date = new Date()): boolean | null {
  if (!oh) return null;
  const s = oh.trim().replace(/,\s+(?=(?:Mo|Tu|We|Th|Fr|Sa|Su|PH|SH)\b)/g, ',').replace(/\s+/g, ' ');
  if (!s) return null;
  if (/^24\/7$/.test(s) || /^Mo-Su 00:00-24:00$/.test(s)) return true;
  const today = dayIndex(when);
  const nowMin = when.getHours() * 60 + when.getMinutes();
  let result: boolean | null = false;
  let matchedAny = false;
  for (const raw of s.split(';')) {
    const rule = raw.trim();
    if (!rule) continue;
    const m = rule.match(/^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su|PH|SH)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?,?)+)?\s*(.*)$/);
    if (!m) return null;
    const days = m[1] ? parseDays(m[1].replace(/,$/, '')) : new Set([0, 1, 2, 3, 4, 5, 6]);
    if (!days) return null;
    const rest = (m[2] || '').trim();
    if (!days.has(today)) continue;
    matchedAny = true;
    if (/^(off|closed)$/i.test(rest)) { result = false; continue; }
    if (rest === '' ) { result = true; continue; }
    const ranges = rest.split(',').map((r) => r.trim());
    let open = false;
    for (const r of ranges) {
      const t = r.match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\+?$/);
      if (!t) return null;
      const a = toMin(t[1]); let b = toMin(t[2]);
      if (b <= a) b += 24 * 60;
      if ((nowMin >= a && nowMin < b) || (nowMin + 24 * 60 >= a && nowMin + 24 * 60 < b)) open = true;
    }
    result = open;
  }
  return matchedAny ? result : false;
}

export function is247(oh: string | undefined): boolean {
  return !!oh && (/^24\/7$/.test(oh.trim()) || /^Mo-Su 00:00-24:00$/.test(oh.trim()));
}

/** Przyjazny opis godzin po polsku. */
export function describeHours(oh: string | undefined): string {
  if (!oh) return 'brak informacji o godzinach';
  if (is247(oh)) return 'całodobowo (24/7)';
  let s = oh;
  for (const [en, pl] of Object.entries(DAY_PL)) s = s.replace(new RegExp(`\\b${en}\\b`, 'g'), pl);
  return s.replace(/\boff\b/g, 'nieczynne').replace(/;\s*/g, '; ');
}
