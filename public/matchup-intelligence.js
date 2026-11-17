/* Sports Spreads matchup intelligence contract v0.1.
 * A missing metric is missing, not zero. No odds or confidence are invented.
 * Coaching H2H is descriptive until adjusted for roster/era/coach changes.
 */
(function(root){
 'use strict';
 const CATALOG=Object.freeze({
  nfl:[
   ['qb_blitz','QB vs blitz','QB EPA/play and success rate against tagged blitzes vs defense blitz/pressure rate',75],
   ['coverage','Coverage matchup','Opponent man/zone coverage tendencies vs QB efficiency by coverage',75],
   ['pass_rush','Protection vs pass rush','Offensive line pass-block performance versus defensive pressure rates',75],
   ['coaching','Coaching & situational tendencies','Staff tendencies, adjustments, fourth-down strategy; head-to-head is descriptive only',12],
   ['personnel','Injuries & availability','Verified starters and personnel availability',1],
   ['rest','Rest and travel','Actual rest differential, travel and short-week context',1]
  ],
  nba:[
   ['pace','Pace and possession quality','Opponent-adjusted pace and scoring efficiency',15],
   ['scheme','Defensive scheme and shot profile','Zone/switch/drop frequency versus player and team shot profile',75],
   ['lineups','Lineups and injuries','Projected active lineup and on/off combinations',1],
   ['rest','Rest and travel','Back-to-back, rest days and travel',1],
   ['coaching','Coaching rotations','Verified rotation tendencies; head-to-head is descriptive only',12]
  ],
  nhl:[
   ['goalies','Goalie matchup','Confirmed starter and save performance versus expected',8],
   ['five_on_five','Five-on-five chance quality','Opponent-adjusted expected goals, shots and chances',15],
   ['special_teams','Special teams','Power-play versus penalty-kill matchup',15],
   ['rest','Rest and travel','Back-to-back schedule and travel',1],
   ['coaching','Coaching system','Line deployment, defensive structure and change-of-coach context',12]
  ],
  mlb:[
   ['starter','Starting pitcher matchup','Confirmed pitcher handedness, pitch mix and batter splits',40],
   ['bullpen','Bullpen freshness','Bullpen innings, availability and leverage usage',8],
   ['lineups','Lineups and defense','Confirmed batting order, platoon splits and defense',1],
   ['park','Park and weather','Park factors, wind direction, roof status and temperature',20],
   ['coaching','Manager decisions','Bullpen/lineup patterns; head-to-head is descriptive only',12]
  ]
 });
 const validNumber=x=>typeof x==='number'&&Number.isFinite(x);
 function evidenceOkay(value,minN){
  if(!value||typeof value!=='object'||!Number.isInteger(value.sampleSize)||value.sampleSize<minN)return false;
  if(typeof value.sourceUrl!=='string'||!/^https:\/\//i.test(value.sourceUrl))return false;
  if(!value.asOf||!Number.isFinite(Date.parse(value.asOf))||Date.parse(value.asOf)>Date.now()+3600000)return false;
  if(typeof value.description!=='string'||!value.description.trim()||value.description.length>240)return false;
  return true;
 }
 function evaluate(game,evidence={},weather=null){
  const league=String(game?.league||'').toLowerCase();
  const definitions=CATALOG[league]||[];
  const factors=definitions.map(([id,label,description,minSample])=>{
   const candidate=evidence[id];
   if(evidenceOkay(candidate,minSample))return {id,label,description,available:true,notes:candidate.description,
    sampleSize:candidate.sampleSize,sourceUrl:candidate.sourceUrl,asOf:candidate.asOf,modelCoefficient:null};
   return {id,label,description,available:false,reason:'Verified matchup statistics not connected',minSample,modelCoefficient:null};
  });
  const weatherAvailable=(league==='nfl'||league==='mlb')&&weather?.status==='forecast'&&Boolean(root.SportsWeatherModel?.assess?.(game,weather)?.available);
  return {version:'matchup-intelligence-v0.1',league,factors,weatherAvailable,
   advancedModelCalibrated:false,probabilityAdjustment:null,confidenceAdjustment:null,
   availableCount:factors.filter(f=>f.available).length,totalCount:factors.length};
 }
 root.SportsMatchups=Object.freeze({CATALOG,evaluate,evidenceOkay});
})(globalThis);
