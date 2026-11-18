/* Sports Spreads experimental season-form model.
 * No hidden ML model, sportsbook data, or calibrated probabilities.
 * It uses current, sourced team records. Weather increases uncertainty, not a
 * directionally invented win advantage. Evaluated only on scheduled real games.
 */
(function(root){
 'use strict';
 const VERSION='season-form-preview-v0.1';
 const CONFIG={
  nfl:{prior:7,home:0.17,weight:0.80,interval:0.115},
  nba:{prior:15,home:0.14,weight:0.75,interval:0.105},
  nhl:{prior:16,home:0.085,weight:0.63,interval:0.115},
  mlb:{prior:30,home:0.095,weight:0.65,interval:0.11}
 };
 const CALIBRATED_RECORDS=Object.freeze({
  nba:Object.freeze({prior:20,intercept:0.2787507901099391,slope:1.1682948273637834,
   calIntercept:-0.10803372226630314,calSlope:1.1376763909614487,holdoutSeason:2025,
   holdoutGames:1225,holdoutBrier:0.2095962418050067,holdoutECE:0.025197590091054257}),
  mlb:Object.freeze({prior:32,intercept:0.10807274819406,slope:0.8220924935092405,
   calIntercept:-0.005230791554107961,calSlope:0.8776684524659046,holdoutSeason:2025,
   holdoutGames:2430,holdoutBrier:0.24544559986595887,holdoutECE:0.023271484259636956})
 });
 function parseRecord(record,league){
  const m=String(record||'').trim().match(/^(\d{1,3})-(\d{1,3})(?:-(\d{1,3}))?$/);
  if(!m)return null;
  const wins=Number(m[1]),losses=Number(m[2]),other=Number(m[3]||0);
  // NFL's third field is tied games. NHL's third field is OTL; no OTL win credit.
  const effectiveWins=wins+(league==='nfl'?0.5*other:0);
  const total=wins+losses+other;
  if(total===0||total>200)return null;
  return {wins,losses,other,effectiveWins,total,raw:String(record).trim()};
 }
 function logistic(x){return 1/(1+Math.exp(-Math.max(-20,Math.min(20,x))));}
 function logit(p){return Math.log(p/(1-p));}
 function clamp(n,a,b){return Math.min(b,Math.max(a,n));}
 // PROVISIONAL RECENCY: this is NOT a holdout-approved model coefficient.
 // The 2025 untouched holdout showed improvement for NFL, but its paired
 // bootstrap interval included zero. NHL rolling form did not beat record-only.
 // Caps are deliberately small, and asterisk/notes must always be displayed.
 function provisionalRecency(snapshot,league,game){
  if(!['nfl','nhl'].includes(league)||!snapshot||
   snapshot.league!==league||snapshot.calibrated!==false||
   snapshot.appliedToForecast!==false||
   snapshot.evidence?.sourceStatus!=='adequate_research_samples'||
   !Number.isInteger(snapshot.home?.played)||!Number.isInteger(snapshot.away?.played)||
   snapshot.home.played<3||snapshot.away.played<3)return null;
  // Defense in depth: an unmatched or future-looking snapshot must NEVER
  // modify a forecast, even if another caller skips the UI cache checks.
  const start=Date.parse(game?.start||'');
  if(!game||game.demo||game.status!=='scheduled'||game.league!==league||
   !game.id||!game.home?.id||!game.away?.id||
   !Number.isFinite(start)||start<=Date.now())return null;
  const gameDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',
   year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(start));
  if(snapshot.gameId!==String(game.id)||snapshot.date!==gameDate||
   snapshot.homeTeamId!==String(game.home.id)||
   snapshot.awayTeamId!==String(game.away.id)||
   snapshot.evidence?.dateCutoff!=='strictly before game calendar date'||
   !(snapshot.evidence.latestCompletedGame<gameDate))return null;
  const m=snapshot.matchup||{},bounded=(x,scale,max)=>{
   if(typeof x!=='number'||!Number.isFinite(x))return 0;
   return clamp(x/scale,-max,max);
  };
  // More recent 5-game form is weighted more heavily than broader
  // differences, but NONE of these coefficients have passed a paired CI test.
  const form=bounded(m.opponentAdjustedFormDelta,1,2);
  const elo=bounded(m.eloDifference,200,2);
  const momentum=bounded(m.rollingMomentumDelta,1,1);
  const rest=bounded(m.restDaysDifference,7,1);
  const raw=league==='nfl'
   ? .029*form+.016*elo+.008*momentum+.005*rest
   : .010*form+.005*elo+.004*momentum+.003*rest;
  return {delta:clamp(raw,league==='nfl'?-.05:-.02,league==='nfl'?.05:.02),
   source:'Last-5 opponent-adjusted form, team Elo, momentum and rest',
   date:snapshot.evidence?.latestCompletedGame||null,formSamples:Math.min(snapshot.home.last5?.games||0,snapshot.away.last5?.games||0)};
 }
 function project(game,options={}){
  if(!game||game.demo||game.status!=='scheduled')return {available:false,reason:'Predictions are only shown for scheduled, verified games.'};
  const c=CONFIG[game.league];if(!c)return {available:false,reason:'Unsupported league'};
  const home=parseRecord(game.home?.record,game.league),away=parseRecord(game.away?.record,game.league);
  if(!home||!away)return {available:false,reason:'Current season records are not available for both teams.'};
  // Beta-binomial shrinkage toward 50% with a league-specific pseudo-game prior.
  const h=(home.effectiveWins+c.prior/2)/(home.total+c.prior);
  const a=(away.effectiveWins+c.prior/2)/(away.total+c.prior);
  const tuned=CALIBRATED_RECORDS[game.league]||null;
  const learned=tuned?logistic(tuned.calIntercept+tuned.calSlope*(
    tuned.intercept+tuned.slope*(logit((home.effectiveWins+tuned.prior/2)/(home.total+tuned.prior))-
     logit((away.effectiveWins+tuned.prior/2)/(away.total+tuned.prior))))):null;
  const recordOnly=tuned?clamp(learned,.02,.98):
    clamp(logistic(c.weight*(logit(h)-logit(a))+c.home),0.12,0.88);
  const recent=provisionalRecency(options.currentForm,game.league,game);
  const homeBase=recent?clamp(recordOnly+recent.delta,.12,.88):recordOnly;
  // Small samples -> broader interval; this is an indicative sensitivity range,
  // not a validated 95% credible interval.
  const sample=Math.min(home.total,away.total);
  const uncertainty=clamp(c.interval+0.13/Math.sqrt(sample+1),0.075,0.22);
  const forecast=options.weather;
  const outdoor=(game.league==='nfl'||game.league==='mlb')&&game.venueIndoor!==true;
  const weatherAssessment=outdoor&&forecast?.status==='forecast'&&root.SportsWeatherModel?.assess?
    root.SportsWeatherModel.assess(game,forecast):null;
  const tier=weatherAssessment?.available?Number(weatherAssessment.severity):null;
  const weatherExtra=tier===null?0:tier===0?0:tier===1?0.02:tier===2?0.04:0.07;
  // Weather has no directional impact unless such an effect is estimated and
  // independently backtested. It enlarges uncertainty for volatile matchups.
  const uncertaintyWithWeather=clamp(uncertainty+weatherExtra,0.07,0.29);
  const model={available:true,version:tuned?'record-holdout-2025-v1':recent?'provisional-rolling-form-v1':VERSION,
   source:recent?'ESPN team records + cached season-form ledger':'ESPN unofficial scoreboard · team records',
   homeProbability:homeBase,awayProbability:1-homeBase,homeRecord:home.raw,awayRecord:away.raw,
   homeName:game.home.name,awayName:game.away.name,
   low:clamp(homeBase-uncertaintyWithWeather,0.01,0.99),high:clamp(homeBase+uncertaintyWithWeather,0.01,0.99),
   uncertaintyPp:Math.round(uncertaintyWithWeather*100),
   weatherUncertaintyPp:Math.round(weatherExtra*100),weatherTier:weatherAssessment?.available?weatherAssessment.tier:null,
   sampleGames:sample,validated:!!tuned,validationScope:tuned?'historical team W-L record-only':'none',
   holdoutGames:tuned?.holdoutGames||0,holdoutBrier:tuned?.holdoutBrier||null,holdoutECE:tuned?.holdoutECE||null,
   marketChecked:false,injuriesIncluded:false,
   recencyUsed:!!recent,recencyDeltaPp:recent?Math.round(recent.delta*1000)/10:0,
   recencyDataThrough:recent?.date||null,recencySampleGames:recent?.formSamples||0,
   preliminary:['nfl','nhl'].includes(game.league),
   note:tuned?
    'This record-only estimate was fitted on earlier seasons, calibrated on a separate season and passed an independent 2025 season holdout. It does not account for injuries, lineups, quarterback schemes, pitching matchups or the sportsbook market. Weather sensitivity is not a confidence interval. It is not a proven wagering edge.':
    recent?
     'PRELIMINARY*: Season W-L estimate with a bounded recency overlay from completed earlier games. NFL rolling form improved Brier but did not pass the paired statistical gain gate; NHL did not outperform the record-only reference. The adjustment is not independently calibrated, not a wagering confidence grade, and never alters sportsbook prices.':
     'PRELIMINARY*: Season W-L estimate only; current form has not been verified or is stale. No independent holdout calibration has passed.'};
  return model;
 }
 root.SportsPrediction=Object.freeze({VERSION,CALIBRATED_RECORDS,parseRecord,provisionalRecency,project});
})(globalThis);
