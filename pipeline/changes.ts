// Dziennik zmian zbioru: porównanie dwóch wersji (po stałym identyfikatorze aed_uid).
// Pokazuje, że zbiór żyje — co noc wiadomo, ile AED przybyło, ubyło i co się zmieniło.

export type Rec = Record<string, string>;

export interface ChangeEntry {
  data: string;               // znacznik czasu aktualizacji (ISO 8601)
  poprzednio: number;         // liczba rekordów przed
  teraz: number;              // liczba rekordów po
  dodane: number;
  usuniete: number;
  zmienione: number;
  zmiany_pol: Record<string, number>;  // ile rekordów zmieniło dane pole
  przyklady: {
    dodane: { aed_uid: string; nazwa: string; miejscowosc: string }[];
    usuniete: { aed_uid: string; nazwa: string; miejscowosc: string }[];
    zmienione: { aed_uid: string; nazwa: string; pola: string[] }[];
  };
}

// pola techniczne — ich zmiana nie jest zmianą informacji o AED
const IGNORED = new Set(['jakosc', 'data_aktualizacji']);
const brief = (r: Rec) => ({ aed_uid: r.aed_uid, nazwa: r.nazwa || r.opis_lokalizacji || 'Defibrylator AED', miejscowosc: r.miejscowosc || '' });

export function diffDatasets(prev: Rec[], next: Rec[], when: string, examples = 8): ChangeEntry {
  const total = [prev.length, next.length];
  // identyfikatory niejednoznaczne (zdublowane w którejś wersji) nie nadają się do porównania — pomijamy je
  const dupes = new Set<string>();
  for (const list of [prev, next]) { const seen = new Set<string>(); for (const r of list) { if (seen.has(r.aed_uid)) dupes.add(r.aed_uid); seen.add(r.aed_uid); } }
  prev = prev.filter((r) => !dupes.has(r.aed_uid));
  next = next.filter((r) => !dupes.has(r.aed_uid));
  const before = new Map(prev.map((r) => [r.aed_uid, r]));
  const after = new Map(next.map((r) => [r.aed_uid, r]));
  const added = next.filter((r) => !before.has(r.aed_uid));
  const removed = prev.filter((r) => !after.has(r.aed_uid));
  const fieldCounts: Record<string, number> = {};
  const changed: { r: Rec; pola: string[] }[] = [];
  for (const r of next) {
    const o = before.get(r.aed_uid);
    if (!o) continue;
    const keys = new Set([...Object.keys(o), ...Object.keys(r)]);
    const pola = [...keys].filter((k) => !IGNORED.has(k) && (o[k] || '') !== (r[k] || '')).sort();
    if (!pola.length) continue;
    changed.push({ r, pola });
    for (const k of pola) fieldCounts[k] = (fieldCounts[k] || 0) + 1;
  }
  return {
    data: when,
    poprzednio: total[0],
    teraz: total[1],
    dodane: added.length,
    usuniete: removed.length,
    zmienione: changed.length,
    zmiany_pol: Object.fromEntries(Object.entries(fieldCounts).sort((a, b) => b[1] - a[1])),
    przyklady: {
      dodane: added.slice(0, examples).map(brief),
      usuniete: removed.slice(0, examples).map(brief),
      zmienione: changed.slice(0, examples).map(({ r, pola }) => ({ aed_uid: r.aed_uid, nazwa: brief(r).nazwa, pola })),
    },
  };
}

/** Dopisuje wpis do historii (najnowszy pierwszy). Aktualizacja bez żadnych zmian nie tworzy wpisu. */
export function appendHistory(history: ChangeEntry[], e: ChangeEntry, keep = 60): ChangeEntry[] {
  if (!e.dodane && !e.usuniete && !e.zmienione) return history;
  return [e, ...history].slice(0, keep);
}
