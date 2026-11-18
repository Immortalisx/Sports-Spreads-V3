import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const core=readFileSync(new URL('../engine/nfl-availability-snapshot.mjs',import.meta.url),'utf8');
const edge=readFileSync(new URL('../supabase/functions/nfl-availability/nfl-availability-snapshot.mjs',import.meta.url),'utf8');
const service=readFileSync(new URL('../supabase/functions/nfl-availability/index.ts',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/migrations/006_nfl_availability_cache.sql',import.meta.url),'utf8');
test('server uses same independently tested injury/QB rules',()=>assert.equal(core,edge));
test('public GET cannot fetch ESPN or consume user credits; only private cron POST refreshes',()=>{
 const publicGet=service.slice(service.indexOf("if(req.method==='GET'){"),service.indexOf("if(!(await approved(req)))"));
 assert.match(publicGet,/sports_nfl_availability_latest/);
 assert.doesNotMatch(publicGet,/source\(|refresh\(|espn\.com|THE_ODDS_API_KEY/);
 assert.match(service,/verify_sports_odds_refresh_token/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all .* from anon,authenticated/);
 assert.match(service,/sourceFailures/);
 assert.match(service,/probabilitiesChanged:false/);
});
