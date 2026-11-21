// Jednorazowo: odtwarza dziennik zmian z historii wersji data/aed.json w repozytorium git.
// Uruchomienie: node pipeline/seed-changes.ts
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { diffDatasets, appendHistory } from './changes.ts';
import type { ChangeEntry, Rec } from './changes.ts';

const ROOT = join(import.meta.dirname, '..');
const git = (...a: string[]) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 30 });
const commits = git('log', '--reverse', '--format=%H %cI %s', '--', 'data/aed.json').trim().split('\n').map((l) => l.split(' '));
let history: ChangeEntry[] = [];
let prev: Rec[] | null = null;
for (const [sha, when, ...subj] of commits) {
  const cur = (JSON.parse(git('show', `${sha}:data/aed.json`)).dane || []) as Rec[];
  if (prev && subj.join(' ').startsWith('Dane: automatyczna aktualizacja')) { // tylko nocne aktualizacje danych, nie zmiany kodu
    const e = diffDatasets(prev, cur, when);
    history = appendHistory(history, e);
    console.log(when, `+${e.dodane} −${e.usuniete} ~${e.zmienione}`);
  }
  prev = cur;
}
const json = JSON.stringify({ opis: 'Dziennik zmian zbioru AED (porównanie kolejnych aktualizacji po aed_uid)', historia: history }, null, 1);
writeFileSync(join(ROOT, 'data', 'zmiany.json'), json);
writeFileSync(join(ROOT, 'web', 'public', 'data', 'zmiany.json'), json);
