import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/betbetter-nflverse-cross-source-2026.json', import.meta.url), 'utf8'));
const dateDelta = (a, b) => (Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000;

test('offline cross-source fixture has unique, scored NFL matches and preserves raw dates', () => {
  const { matchedGames: games, scope } = fixture;
  assert.equal(games.length, 45);
  assert.equal(scope.teachingNFLRows, 95);
  assert.equal(scope.excluded, 50);
  assert.equal(scope.excludedPreseason + scope.excludedProBowl, scope.excluded);
  const seen = new Set();
  const differences = [];
  for (const game of games) {
    assert.match(game.nflverseDate, /^2026-\d{2}-\d{2}$/);
    assert.match(game.teachingDate, /^2026-\d{2}-\d{2}$/);
    assert.match(game.home, /^[A-Z]{2,3}$/);
    assert.match(game.away, /^[A-Z]{2,3}$/);
    assert.notEqual(game.home, game.away);
    assert.ok(Number.isInteger(game.homeScore) && game.homeScore >= 0);
    assert.ok(Number.isInteger(game.awayScore) && game.awayScore >= 0);
    const key = [game.nflverseDate, game.home, game.away].join('|');
    assert.ok(!seen.has(key), 'duplicate matchup: ' + key);
    seen.add(key);
    differences.push(dateDelta(game.teachingDate, game.nflverseDate));
  }
  assert.equal(differences.filter(x => x === 0).length, 37);
  assert.equal(differences.filter(x => x === 1).length, 8);
  assert.ok(differences.every(x => x === 0 || x === 1));
  assert.equal(scope.exactDate, 37);
  assert.equal(scope.oneDayLater, 8);
  assert.equal(scope.scoreConflicts, 0);
});

test('source identifiers and integrity hashes are pinned', () => {
  assert.match(fixture.sources.teachingSha256, /^[a-f0-9]{64}$/);
  assert.match(fixture.sources.nflverseSha256, /^[a-f0-9]{64}$/);
  assert.equal(fixture.sources.nflverseBlobSha, '77580b1ff3255acb477153f993954f6e1c60a5c8');
});


test('all 50 excluded teaching NFL games are individually pinned and disjoint', () => {
  const csv = readFileSync(new URL('./fixtures/betbetter-nfl-excluded-2026.csv', import.meta.url), 'utf8');
  const lines = csv.trim().split(/\r?\n/).filter(line => !line.startsWith('#'));
  const excluded = lines.map((line) => {
    const cells = line.split(',');
    assert.equal(cells.length, 5);
    const [date, home, away, hs, as] = cells;
    assert.match(date, /^2026-\d{2}-\d{2}$/);
    assert.match(home, /^[A-Z]{2,3}$/);
    assert.match(away, /^[A-Z]{2,3}$/);
    assert.notEqual(home, away);
    assert.match(hs, /^\d+$/);
    assert.match(as, /^\d+$/);
    return { date, home, away, homeScore: Number(hs), awayScore: Number(as) };
  });
  assert.equal(excluded.length, 50);
  assert.equal(excluded.filter(g => g.home === 'AFC' && g.away === 'NFC').length, 1);
  assert.equal(excluded.filter(g => g.date.startsWith('2026-08-')).length, 49);
  const matched = fixture.matchedGames;
  const all = [
    ...matched.map(g => [g.teachingDate, g.home, g.away, g.homeScore, g.awayScore].join('|')),
    ...excluded.map(g => [g.date, g.home, g.away, g.homeScore, g.awayScore].join('|'))
  ];
  assert.equal(all.length, 95);
  assert.equal(new Set(all).size, 95);
  const matchupKeys = [
    ...matched.map(g => [g.teachingDate, g.home, g.away].join('|')),
    ...excluded.map(g => [g.date, g.home, g.away].join('|'))
  ];
  assert.equal(new Set(matchupKeys).size, 95);
});
