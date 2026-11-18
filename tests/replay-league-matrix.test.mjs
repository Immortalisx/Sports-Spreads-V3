import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {replayLeagueMatrix} from '../engine/replay-league-matrix.mjs';

const workflow=readFileSync(new URL('../.github/workflows/opponent-replay-research.yml',import.meta.url),'utf8');
for(const [selection,expected] of [['nfl',['nfl']],['nhl',['nhl']],['both',['nfl','nhl']]]){
  test('manual replay matrix '+selection+' schedules exactly requested league jobs',()=>{
    assert.deepEqual(replayLeagueMatrix(selection),{league:expected});
    const output=execFileSync(process.execPath,['engine/replay-league-matrix.mjs',selection],{encoding:'utf8'}).trim();
    assert.deepEqual(JSON.parse(output.slice('matrix='.length)),{league:expected});
    assert.ok(output.startsWith('matrix='));
  });
}
test('invalid, empty, or case-altered selectors fail closed',()=>{
  for(const selection of ['', 'NBA','NFL','nhl,nfl','both;echo','all',undefined]){
    assert.throws(()=>replayLeagueMatrix(selection),/Invalid replay league/);
  }
});
test('workflow uses generated dynamic matrix and never schedules unselected league',()=>{
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/type: choice/);
  assert.match(workflow,/default: nfl/);
  assert.match(workflow,/needs: select/);
  assert.match(workflow,/matrix: \$\{\{ fromJSON\(needs\.select\.outputs\.matrix\) \}\}/);
  assert.match(workflow,/node engine\/replay-league-matrix\.mjs "\$SELECTED_LEAGUE" >> "\$GITHUB_OUTPUT"/);
  assert.doesNotMatch(workflow,/league: \[nfl, nhl\]/);
  assert.doesNotMatch(workflow,/schedule:|push:/);
  assert.match(workflow,/pull_request:\\n    paths:/);
  assert.match(workflow,/github.event_name == 'pull_request' && 'both' \\|\\| inputs.league/);
});
test('research replay is read-only and does not deploy or promote',()=>{
  assert.match(workflow,/permissions:\s*\n  contents: read/);
  assert.match(workflow,/node engine\/collect-opponent-replay\.mjs \$\{\{ matrix\.league \}\}/);
  assert.doesNotMatch(workflow,/deploy|render\.com|production|secrets\./i);
});
