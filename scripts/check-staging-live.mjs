/** Read-only staging integration check. Never invokes refresh POST or paid odds provider. */
const site='https://sports-spreads-v4-staging.onrender.com';
const api='https://nwspnepkmeoytlkbltfe.supabase.co/functions/v1';
const routes=[
 ['sports-feed?path=%2Fapis%2Fsite%2Fv2%2Fsports%2Ffootball%2Fnfl%2Fscoreboard',true],
 ['sportsbook-odds?league=nfl&mode=board',false],
 ['daily-tickets',false],
 ['season-form?league=nfl',false],
 ['nfl-availability',false],
 ['nhl-goalie-form',false],
 ['matchup-signals?league=mlb&date=2026-11-18&home=Boston%20Red%20Sox&away=New%20York%20Yankees',false]
];
let failed=0;
async function check(name,url,kind='json'){
 try{
  const r=await fetch(url,{headers:{Origin:site,Accept:kind==='html'?'text/html':kind==='js'?'application/javascript':'application/json'},signal:AbortSignal.timeout(18000),redirect:'follow'});
  const cors=r.headers.get('access-control-allow-origin');
  if(kind==='json'&&cors!==site)throw Error('CORS mismatch: '+cors);
  if(!r.ok)throw Error('HTTP '+r.status);
  const body=await r.text();
  if(kind==='html'){if(!body.includes('Sports Spreads')||!body.includes('app.js'))throw Error('Staging HTML missing expected app');}
  else if(kind==='js'){if(!body.includes('function ')||body.length<10000)throw Error('Staging app JS missing expected bundle');}
  else{const parsed=JSON.parse(body);if(!parsed||typeof parsed!=='object')throw Error('No JSON payload');}
  console.log('PASS '+name+' '+r.status);
 }catch(e){failed++;console.error('FAIL '+name+' '+e.message);}
}
await check('staging index',site+'/','html');
await check('staging app JS',site+'/app.js','js');
for(const [route] of routes)await check(route,api+'/'+route);
if(failed)process.exitCode=1;
