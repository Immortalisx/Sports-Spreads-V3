import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const names=['sports-feed','sportsbook-odds','daily-tickets','season-form','nfl-availability','nhl-goalie-form','matchup-signals'];
for(const name of names){
 test(name+' supports V4 staging and production without wildcard CORS',()=>{
  const src=readFileSync(new URL('../supabase/functions/'+name+'/index.ts',import.meta.url),'utf8');
  assert.ok(src.includes('https://sports-spreads.onrender.com'));
  assert.ok(src.includes('https://sports-spreads-v4-staging.onrender.com'));
  assert.ok(!/access-control-allow-origin['"]?\s*:\s*['"]\*/i.test(src));
 });
}
