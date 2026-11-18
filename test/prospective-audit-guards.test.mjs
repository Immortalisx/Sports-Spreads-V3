import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/migrations/013_prospective_outcome_audit.sql',import.meta.url),'utf8');
const forecast=readFileSync(new URL('../supabase/migrations/012_future_model_snapshots.sql',import.meta.url),'utf8');

test('prospective outcome audit is security-invoker and inaccessible to public roles',()=>{
 assert.match(sql,/security_invoker\s*=\s*true/i);
 assert.match(sql,/revoke all on public\.sports_model_vs_market_audit from public,anon,authenticated/i);
 assert.match(sql,/grant select on public\.sports_model_vs_market_audit to service_role,postgres/i);
});
test('only completed games with valid non-tied scores can grade predictions',()=>{
 assert.match(sql,/g\.event->>'final'\s*=\s*'true'/i);
 assert.match(sql,/homeScore'<>g\.event->>'awayScore'/i);
 assert.match(sql,/where f\.recorded_at<o\.game_start/i);
 assert.match(sql,/o\.game_id=f\.game_id/i);
});
test('market comparison uses pregame, pre-forecast, strictly bounded historical odds',()=>{
 assert.match(sql,/hist\.source_as_of<=f\.recorded_at/i);
 assert.match(sql,/hist\.source_as_of>=f\.recorded_at-interval '90 minutes'/i);
 assert.match(sql,/hist\.source_as_of<o\.game_start/i);
 assert.match(sql,/hist\.game_at=o\.game_start/i);
 assert.match(sql,/hist\.home_name=o\.home_name/i);
 assert.match(sql,/hist\.away_name=o\.away_name/i);
});
test('forecast archive remains private and cannot rewrite historical probabilities',()=>{
 assert.match(forecast,/enable row level security/i);
 assert.match(forecast,/revoke all on public\.sports_record_forecast_history from anon,authenticated/i);
 assert.match(forecast,/on conflict[^;]*do nothing/is);
});
