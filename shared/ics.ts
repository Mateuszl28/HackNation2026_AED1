// Kalendarz przypomnień serwisowych AED (iCalendar, RFC 5545) — dla dysponentów.
// Terminy: koniec ważności elektrod i baterii oraz coroczna kontrola sprawności.
import type { AedRecord } from './schema.ts';

export interface ServiceEvent { date: string; title: string; description: string; uid: string; }

/** Dodaje miesiące z przycięciem dnia do końca miesiąca (31 marca − 1 mies. = 28/29 lutego, nie 3 marca). */
const addMonths = (iso: string, m: number) => {
  const [y, mo, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, mo - 1 + m, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
};
const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export function serviceEvents(recs: AedRecord[], today = new Date().toISOString().slice(0, 10)): ServiceEvent[] {
  const out: ServiceEvent[] = [];
  recs.forEach((r, i) => {
    const name = r.nazwa || `AED ${r.id || i + 1}`;
    const where = [r.opis_lokalizacji, [r.nazwa_ulicy, r.nr_budynku].filter(Boolean).join(' '), r.miejscowosc].filter(Boolean).join(', ');
    const key = (r.id || `${r.szerokosc_geograficzna},${r.dlugosc_geograficzna}`).replace(/[^A-Za-z0-9.,_-]/g, '');
    if (isDate(r.data_waznosci_elektrod)) {
      out.push({ date: addMonths(r.data_waznosci_elektrod, -1), uid: `${key}-elektrody`, title: `AED: wymień elektrody — ${name}`, description: `Elektrody tracą ważność ${r.data_waznosci_elektrod}. ${where}` });
    }
    if (isDate(r.data_waznosci_baterii)) {
      out.push({ date: addMonths(r.data_waznosci_baterii, -1), uid: `${key}-bateria`, title: `AED: wymień baterię — ${name}`, description: `Bateria traci ważność ${r.data_waznosci_baterii}. ${where}` });
    }
    // coroczna kontrola: 12 miesięcy po ostatniej (albo od dziś, gdy brak daty — z prośbą o pierwszą kontrolę)
    const next = isDate(r.data_ostatniej_kontroli) ? addMonths(r.data_ostatniej_kontroli, 12) : today;
    out.push({ date: next < today ? today : next, uid: `${key}-kontrola`, title: `AED: kontrola sprawności — ${name}`, description: `${isDate(r.data_ostatniej_kontroli) ? `Ostatnia kontrola: ${r.data_ostatniej_kontroli}.` : 'Brak daty ostatniej kontroli — sprawdź urządzenie i uzupełnij dane.'} Po kontroli zaktualizuj pole data_ostatniej_kontroli w zbiorze na dane.gov.pl. ${where}` });
  });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
/** Łamanie linii co 75 oktetów (RFC 5545 §3.1). */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = []; let cur = '';
  for (const ch of line) { if (new TextEncoder().encode(cur + ch).length > (parts.length ? 74 : 75)) { parts.push(cur); cur = ''; } cur += ch; }
  parts.push(cur);
  return parts.join('\r\n ');
}

export function toIcs(events: ServiceEvent[], calName = 'AED — przypomnienia serwisowe'): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AEDostepni//Przypomnienia serwisowe AED//PL', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(calName)}`];
  for (const e of events) {
    const d = e.date.replace(/-/g, '');
    lines.push('BEGIN:VEVENT', `UID:${e.uid}@aedostepni`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `SUMMARY:${esc(e.title)}`, `DESCRIPTION:${esc(e.description)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-P7D', `DESCRIPTION:${esc(e.title)}`, 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
