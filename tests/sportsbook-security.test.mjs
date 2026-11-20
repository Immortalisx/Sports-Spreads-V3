import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
test('no raw provider key or service-role token is placed in published HTML',()=>{const html=read('release/index.html');assert.match(html,/SS_ODDS_CONFIG/);assert.match(html,/sportsbook-odds/);assert.match(html,/odds-browser-v0.1|sportsbook-odds-v0.1/);assert.doesNotMatch(html,/THE_ODDS_API_KEY|SUPABASE_SERVICE_ROLE_KEY|sb_secret_/);});
test('server only lets visitors receive one exact matchup and enforces a monthly cap',()=>{
 const server=read('supabase/functions/sportsbook-odds/index.ts');assert.match(server,/MAX_PER_MONTH=400/);assert.match(server,/CACHE_MS=8\*60\*60\*1000/);assert.match(server,/reserve_sports_odds_credit/);assert.match(server,/matches\.length===1\?matches:\[\]/);assert.match(server,/THE_ODDS_API_KEY/);assert.match(server,/market/i);
 const sql=read('supabase/migrations/002_sportsbook_odds_cache.sql');assert.match(sql,/enable row level security/g);assert.match(sql,/revoke all on public\.sports_odds_cache from anon, authenticated/);assert.match(sql,/grant execute.*service_role/);
});
test('bookmaker quotes and probable MLB starter details are strictly read-only',()=>{const s=read('supabase/functions/matchup-signals/index.ts');assert.match(s,/statsapi\.mlb\.com/);assert.match(s,/probablePitcher/);assert.match(s,/No unambiguous MLB game match/);assert.match(read('src/app/21-game-detail.js'),/Saved moneylines/);assert.match(read('src/app/28-odds-signals.js'),/useSportsbookQuote/);});
