import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudConfig,cloudTickets,CloudError,validateSnapshot} from '../lib/cloud.mjs';
const legs=[{selection:'Test player',league:'nfl',market:'Player yards',notes:'Over 49.5 yards',odds:-110}];
test('cloud stays explicitly disabled without a Supabase project',()=>{
 assert.equal(cloudConfig({}).configured,false);
 assert.equal(cloudConfig({SUPABASE_URL:'http://example.com',SUPABASE_PUBLISHABLE_KEY:'public'}).configured,false);
});
test('server validates and recomputes archive math rather than trusting client payout',()=>{
 const got=validateSnapshot({label:'My picks',stake:10,legs,potential_return:99999});
 assert.equal(got.potential_return,19.09);
 assert.equal(got.combined_american_odds,'-110');
 assert.equal(got.odds_source,'manual_unverified');
 assert.ok(!('user_id' in got));
 assert.ok(!('modelProbability' in got));
 assert.throws(()=>validateSnapshot({stake:0,legs}),CloudError);
 assert.throws(()=>validateSnapshot({stake:10,legs:[{...legs[0],odds:50}]}),CloudError);
});
test('cloud API requires user bearer token and forwards it with RLS-bound publishable key',async()=>{
 const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_example'};
 await assert.rejects(()=>cloudTickets({method:'GET',env}),e=>e.status===401);
 let captured;
 const fetcher=async(url,opts)=>{captured={url,opts};return {ok:true,json:async()=>[{id:'ticket-1'}]};};
 const saved=await cloudTickets({method:'POST',auth:'Bearer sample.jwt.token',body:{stake:10,legs},env,fetcher});
 assert.equal(saved[0].id,'ticket-1');
 assert.equal(captured.opts.headers.authorization,'Bearer sample.jwt.token');
 assert.equal(captured.opts.headers.apikey,'sb_publishable_example');
 assert.equal(JSON.parse(captured.opts.body).potential_return,19.09);
 assert.equal(JSON.parse(captured.opts.body).user_id,undefined);
});
