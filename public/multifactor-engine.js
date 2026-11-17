/* Sports Spreads: point-in-time, source-gated sport-specific feature contract.
 * Advanced factors NEVER affect a prediction without an out-of-time validated
 * coefficient manifest. Never treat missing inputs as zero or as neutral.
 */
(function(root){
 'use strict';
 const VERSION='multifactor-contract-v0.2';
 // A signed difference favors the home team. A matchup must have both sides.
 const CATALOG=Object.freeze({
  nfl:[
   ['qb_blitz_edge','QB vs blitz / defense blitz response',70,'NFL Next Gen Stats or verified play charting'],
   ['receiver_blitz_edge','Receiver versus opponent blitz frequency',25,'FTN charting joined to nflverse play-by-play, verified receiver ID'],
   ['coverage_edge','QB man/zone efficiency vs opponent coverage',75,'NFL Next Gen Stats / play charting'],
   ['protection_edge','O-line pass protection vs defensive rush',70,'Verified pressure / protection splits'],
   ['coach_adjustments','Coaching: opponent-adjusted tendencies',100,'Game-by-game coach history and staff tenure'],
   ['coach_h2h','Head coaches head-to-head (descriptive)',12,'Verified coaches, dates and opponent rosters'],
   ['rest_travel','Rest and travel differential',1,'Prior finalized game schedule'],
   ['roster_availability','Verified starter/positional availability',1,'Time-stamped official injury reports']
  ],
  nba:[
   ['scheme_edge','Offensive profile vs switching/drop/zone',90,'NBA tracking / defensive matchup'],
   ['pace_efficiency','Possession efficiency and expected pace',125,'Team possessions with opponent adjustment'],
   ['lineup_edge','Available lineup net rating and fit',80,'Time-stamped lineups / play-by-play'],
   ['rim_three_edge','Rim protection versus 3-point shot profile',80,'Shot location and on/off tracking'],
   ['rest_travel','Back-to-back, travel and rest',1,'Finalized game schedule'],
   ['coach_rotations','Coaching rotation and late-game tendencies',60,'Possession-level lineup / coaching history']
  ],
  nhl:[
   ['goalie_gsax','Confirmed starter versus expected saves',15,'Goalie expected goals against / start confirmation'],
   ['fivevfive_xg','5-on-5 xG and shot-quality interaction',200,'Game situation-adjusted NHL shot events'],
   ['special_teams','Power play vs opposing penalty kill',120,'Special teams attempts / efficiencies'],
   ['line_matchups','Line deployments and matchup defense',80,'Verified line/pairing shift history'],
   ['rest_travel','Back-to-back and travel differential',1,'Prior finalized game schedule'],
   ['coach_system','Coaching system / tactical adjustments',75,'Line deployment and tactical history']
  ],
  mlb:[
   ['pitcher_hitter','Pitch mix vs projected hitters (platoon, whiff)',90,'Baseball Savant Statcast pitch-level splits'],
   ['pitcher_stuff','Starter pitch quality and repertoire',80,'Statcast xwOBA, whiff and Stuff+'],
   ['bullpen_freshness','Bullpen availability vs opposing lineup',10,'Prior game usage, workload and projected roles'],
   ['platoon_lineup','Confirmed lineup and handedness splits',100,'Confirmed batting orders and Statcast splits'],
   ['fielding_park','Fielding / park interaction',120,'Statcast OAA and park factors'],
   ['manager_decisions','Manager platoon/bullpen tendencies',60,'Verified historical game decisions']
  ]
 });
 const asNumber=x=>typeof x==='number' && Number.isFinite(x);
 function eligible(game,id,item){
  const def=(CATALOG[game?.league]||[]).find(([name])=>name===id);
  if(!def||!item||typeof item!=='object')return {ok:false,reason:'Not provided'};
  if(!asNumber(item.homeMinusAway)||Math.abs(item.homeMinusAway)>5)return {ok:false,reason:'No validated matchup difference'};
  if(!Number.isInteger(item.sampleSize)||item.sampleSize<def[2])return {ok:false,reason:`Fewer than ${def[2]} relevant observations`};
  if(!/^https:\/\/[^\s/]+/.test(String(item.sourceUrl||'')))return {ok:false,reason:'Missing source URL'};
  const kickoff=Date.parse(game.start||'');
  const asOf=Date.parse(item.asOf||''),dataThrough=Date.parse(item.dataThrough||'');
  if(!Number.isFinite(kickoff)||!Number.isFinite(asOf)||!Number.isFinite(dataThrough)||asOf>=kickoff||dataThrough>=kickoff||dataThrough>asOf)return {ok:false,reason:'Future or unverified timestamp'};
  if(asOf> Date.now()+300000)return {ok:false,reason:'Future snapshot timestamp'};
  return {ok:true,code:id,delta:item.homeMinusAway,sourceUrl:item.sourceUrl,asOf:item.asOf,dataThrough:item.dataThrough,sampleSize:item.sampleSize};
 }
 function evaluate(game,evidence={}){
  return (CATALOG[game?.league]||[]).map(([id,label,minSample,sourceHint])=>{
   const x=eligible(game,id,evidence[id]);
   return {id,label,minSample,sourceHint,...x};
  });
 }
 // Training manifests MUST be produced by the walk-forward validator, not
 // by the UI or a manually guessed importance score.
 function validateManifest(m,league,game){
  if(!m||m.status!=='validated' || m.league!==league || m.featureContract!==VERSION)return false;
  if(!m.metrics||m.metrics.count<({nfl:200,nba:500,nhl:450,mlb:800}[league]||Infinity))return false;
  if(!asNumber(m.metrics.brier)||!asNumber(m.metrics.baselineBrier)||m.metrics.brier>=m.metrics.baselineBrier)return false;
  if(!asNumber(m.metrics.ece)||m.metrics.ece>0.045)return false;
  const start=Date.parse(game.start||'');
  if(!Number.isFinite(start)||!Number.isFinite(Date.parse(m.trainedThrough||''))||Date.parse(m.trainedThrough)>=start)return false;
  const defs=new Set((CATALOG[league]||[]).map(x=>x[0]));
  if(!m.weights||typeof m.weights!=='object'||!Object.keys(m.weights).length)return false;
  return Object.entries(m.weights).every(([k,v])=>defs.has(k)&&asNumber(v)&&Math.abs(v)<=1.5);
 }
 function estimate(game,baseline,evidence={},manifest=null){
  const checks=evaluate(game,evidence);
  const result={version:VERSION,league:game?.league,available:checks.filter(x=>x.ok).length,possible:checks.length,factors:checks,adjusted:false,probability:null,validated:false};
  if(!baseline?.available||!validateManifest(manifest,game?.league,game))return result;
  const needed=Object.keys(manifest.weights);
  if(!needed.every(id=>checks.some(x=>x.id===id&&x.ok)))return {...result,reason:'One or more trained matchup inputs is unavailable.'};
  let logit=Math.log(baseline.homeProbability/(1-baseline.homeProbability));
  for(const [id,w] of Object.entries(manifest.weights)){logit+=w*checks.find(x=>x.id===id).delta;}
  const probability=1/(1+Math.exp(-Math.max(-9,Math.min(9,logit))));
  return {...result,adjusted:true,validated:true,probability:Math.min(.98,Math.max(.02,probability)),modelVersion:manifest.version};
 }
 root.SportsMultifactor=Object.freeze({VERSION,CATALOG,eligible,evaluate,validateManifest,estimate});
})(globalThis);
