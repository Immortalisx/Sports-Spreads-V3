import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/weather.js';
const weather=globalThis.SportsWeather;
const start='2026-11-18T00:30:00Z';
const now=Date.parse('2026-11-17T17:00:00Z');
const outdoor=(id='weather-game-1')=>({id,league:'nfl',venue:'Example Field',venueIndoor:false,venueCity:'Baltimore',venueState:'Maryland',venueCountry:'US',start});
const mk=(v)=>({ok:true,json:async()=>v});
test('indoor games use no paid or external weather request',async()=>{
 let calls=0;
 const result=await weather.get({id:'dome',league:'nfl',venueIndoor:true,start}, {now,fetcher:async()=>{calls++;throw Error('should not fetch');}});
 assert.equal(result.status,'indoors'); assert.equal(calls,0);
});
test('past and far-future games do not request a false forecast',async()=>{
 const past=await weather.get({...outdoor('old'),start:'2026-09-01T00:00:00Z'},{now,fetcher:async()=>{throw Error('unexpected');}});
 assert.equal(past.status,'unavailable');
 const future=await weather.get({...outdoor('future'),start:'2027-02-01T00:00:00Z'},{now,fetcher:async()=>{throw Error('unexpected');}});
 assert.equal(future.status,'unavailable');
});
test('outdoor forecast uses geocoded venue, kickoff hour, and adds wind-risk facts without confidence adjustment',async()=>{
 let calls=0;
 const fetcher=async(url)=>{
  calls++;
  if(url.includes('geocoding-api.open-meteo.com'))return mk({results:[{latitude:39.3,longitude:-76.6,admin1:'Maryland',country_code:'US'}]});
  assert.match(url,/precipitation_probability/);
  return mk({hourly:{time:['2026-11-18T00:00','2026-11-18T01:00'],temperature_2m:[39,40],wind_speed_10m:[20,18],wind_gusts_10m:[31,27],precipitation_probability:[70,60],weather_code:[61,61]}});
 };
 const game=outdoor();
 const value=await weather.get(game,{now,fetcher});
 assert.equal(value.status,'forecast');assert.equal(value.tempF,39);assert.equal(value.windMph,20);
 assert.ok(value.flags.includes('Wind may matter')); assert.ok(value.flags.includes('Rain/snow risk'));
 assert.equal(value.modelAdjusted,false);assert.equal(calls,2);
 const cached=await weather.get(game,{now:now+60000,fetcher:async()=>{throw Error('cache not used');}});
 assert.equal(cached.status,'forecast');
});
test('ambiguous venue location refuses to guess weather',async()=>{
 const g={id:'ambig',league:'mlb',venue:'Unknown Park',venueCity:'Springfield',venueIndoor:false,start};
 const r=await weather.get(g,{now,fetcher:async()=>mk({results:[{latitude:1,longitude:2,admin1:'Missouri',country_code:'US'},{latitude:3,longitude:4,admin1:'Illinois',country_code:'US'}]})});
 assert.equal(r.status,'unavailable');assert.match(r.message,/ambiguous/);
});
test('venue metadata preserves indoor flag from ESPN game mapping',async()=>{
 const {normalizeEvent}=await import('../lib/espn.mjs');
 const g=normalizeEvent({id:'123',date:start,competitions:[{venue:{fullName:'Example Field',indoor:false,address:{city:'Baltimore',state:'Maryland',country:'US'}},competitors:[{homeAway:'home',team:{id:'1',displayName:'Home'}},{homeAway:'away',team:{id:'2',displayName:'Away'}}]}]},'nfl');
 assert.equal(g.venueCity,'Baltimore');assert.equal(g.venueIndoor,false);assert.equal(g.model,null);
});

test('retractable stadium remains weather-relevant until roof state is verified',()=>{
 assert.equal(weather.indoor({...outdoor('roof'),venueIndoor:null,venue:'AT&T Stadium'}),false);
 assert.equal(weather.indoor({...outdoor('fixed'),venueIndoor:null,venue:'Ford Field'}),true);
});
