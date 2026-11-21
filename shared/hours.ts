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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)';
const MON_ITEM = `${MON}(?: \\d{1,2})?(?:-${MON}(?: \\d{1,2})?)?`;
const MONTH_PREFIX = new RegExp(`^(${MON_ITEM}(?:, ?${MON_ITEM})*):?\\s*`);
const DAY_TOKEN = '(?:Mo|Tu|We|Th|Fr|Sa|Su|PH|SH)';

/** Zakres miesięcy z selektora typu „Jun-Aug”, „Dec, Jan”, „Oct 1-Apr 30” (dni miesiąca przybliżamy do miesięcy). */
function parseMonths(spec: string): Set<number> {
  const out = new Set<number>();
  for (const part of spec.split(',')) {
    const m = part.trim().match(new RegExp(`^(${MON})(?: \\d{1,2})?(?:-(${MON})(?: \\d{1,2})?)?$`));
    if (!m) continue;
    const a = MONTHS.indexOf(m[1]), b = m[2] ? MONTHS.indexOf(m[2]) : a;
    for (let i = a; ; i = (i + 1) % 12) { out.add(i); if (i === b) break; }
  }
  return out;
}

/** Ujednolica zapisy spotykane w danych (polskie słowa, przecinki zamiast średników, godziny bez minut). */
export function normalizeHours(oh: string): string {
  let s = oh.trim().replace(/^["'|\s]+|["'|\s]+$/g, '').replace(/\s+/g, ' ');
  if (/^(całodobowo|calodobowo|cała doba|całą dobę|24h|24 h|24\/24|non-stop|nonstop)$/i.test(s)) return '24/7';
  s = s.replace(new RegExp(`(${DAY_TOKEN})\\s*-\\s*(${DAY_TOKEN})`, 'g'), '$1-$2');          // „Mo- Fr” → „Mo-Fr”
  s = s.replace(/(^|[\s,;-])(\d{1,2})(?=-\d)/g, (_m, p: string, h: string) => `${p}${h.padStart(2, '0')}:00`); // „7-21:30”
  s = s.replace(/-(\d{1,2})(?=$|[\s,;])/g, (_m, h: string) => `-${h.padStart(2, '0')}:00`);  // „08:00-16”
  s = s.replace(/\b(\d):(\d{2})/g, '0$1:$2');                                               // „7:15” → „07:15”
  // reguły rozdzielone przecinkiem lub spacją po godzinie → średnik
  s = s.replace(new RegExp(`(\\d{2}:\\d{2}\\+?|off|closed)\\s*(?:,\\s*|\\s+)(?=(?:${DAY_TOKEN}|${MON})\\b)`, 'g'), '$1; ');
  s = s.replace(new RegExp(`,\\s+(?=${DAY_TOKEN}\\b)`, 'g'), ',');
  return s;
}

export function isOpenAt(oh: string | undefined, when: Date = new Date()): boolean | null {
  if (!oh) return null;
  const s = normalizeHours(oh);
  if (!s) return null;
  if (/^24\/7$/.test(s) || /^(Mo-Su )?00:00-24:00$/.test(s)) return true;
  const today = dayIndex(when);
  const month = when.getMonth();
  const nowMin = when.getHours() * 60 + when.getMinutes();
  let result: boolean | null = false;
  let matchedAny = false;
  for (const raw of s.split(';')) {
    let rule = raw.trim();
    if (!rule) continue;
    // selektor sezonowy („Jun-Aug”, „Nov-Mar:”) — reguła obowiązuje tylko w tych miesiącach
    const mp = rule.match(MONTH_PREFIX);
    if (mp) {
      if (!parseMonths(mp[1]).has(month)) continue;
      rule = rule.slice(mp[0].length);
      if (/^(24\/7)?$/.test(rule)) { matchedAny = true; result = true; continue; }
    }
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
