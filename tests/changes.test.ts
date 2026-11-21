import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { diffDatasets, appendHistory } from '../pipeline/changes.ts';

test('dziennik zmian: dodane, usunięte, zmienione pola (bez pól technicznych)', () => {
  const prev = [{ aed_uid: 'A', nazwa: 'Szkoła', godziny_dostepnosci: '' , jakosc: '50' }, { aed_uid: 'B', nazwa: 'Urząd' }];
  const next = [{ aed_uid: 'A', nazwa: 'Szkoła', godziny_dostepnosci: 'Mo-Fr 08:00-16:00', jakosc: '70' }, { aed_uid: 'C', nazwa: 'Basen' }];
  const e = diffDatasets(prev, next, '2026-11-21T03:00:00Z');
  assert.equal(e.dodane, 1);
  assert.equal(e.usuniete, 1);
  assert.equal(e.zmienione, 1);
  assert.deepEqual(e.zmiany_pol, { godziny_dostepnosci: 1 });
  assert.equal(e.przyklady.dodane[0].aed_uid, 'C');
  assert.equal(e.przyklady.usuniete[0].nazwa, 'Urząd');
});

test('dziennik zmian: aktualizacja bez zmian nie tworzy wpisu', () => {
  const same = [{ aed_uid: 'A', nazwa: 'X' }];
  assert.deepEqual(appendHistory([], diffDatasets(same, same, 't')), []);
});

test('opublikowany zbiór: aed_uid jest unikalny', () => {
  const d = JSON.parse(readFileSync(new URL('../data/aed.json', import.meta.url), 'utf8')).dane as { aed_uid: string }[];
  const seen = new Set<string>();
  const dup = d.filter((r) => (seen.has(r.aed_uid) ? true : (seen.add(r.aed_uid), false)));
  assert.equal(dup.length, 0, `zdublowane aed_uid: ${dup.slice(0, 3).map((r) => r.aed_uid).join(', ')}`);
});
