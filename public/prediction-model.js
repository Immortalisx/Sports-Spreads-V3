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
  const homeBase=tuned?clamp(learned,.02,.98):
    clamp(logistic(c.weight*(logit(h)-logit(a))+c.home),0.12,0.88);
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
  const model={available:true,version:tuned?'record-holdout-2025-v1':VERSION,source:'ESPN unofficial scoreboard · team records',
   homeProbability:homeBase,awayProbability:1-homeBase,homeRecord:home.raw,awayRecord:away.raw,
   homeName:game.home.name,awayName:game.away.name,
   low:clamp(homeBase-uncertaintyWithWeather,0.01,0.99),high:clamp(homeBase+uncertaintyWithWeather,0.01,0.99),
   uncertaintyPp:Math.round(uncertaintyWithWeather*100),
   weatherUncertaintyPp:Math.round(weatherExtra*100),weatherTier:weatherAssessment?.available?weatherAssessment.tier:null,
   sampleGames:sample,validated:!!tuned,validationScope:tuned?'historical team W-L record-only':'none',
   holdoutGames:tuned?.holdoutGames||0,holdoutBrier:tuned?.holdoutBrier||null,holdoutECE:tuned?.holdoutECE||null,
   marketChecked:false,injuriesIncluded:false,
   note:tuned?
    'This record-only estimate was fitted on earlier seasons, calibrated on a separate season and passed an independent 2025 season holdout. It does not account for injuries, lineups, quarterback schemes, pitching matchups or the sportsbook market. Weather sensitivity is not a confidence interval. It is not a proven wagering edge.':
    'Research-only estimate from season W-L records, shrinkage and an assumed home edge. Range is not a statistical confidence interval. No independent holdout calibration has passed.'};
  return model;
 }
 root.SportsPrediction=Object.freeze({VERSION,CALIBRATED_RECORDS,parseRecord,project});
})(globalThis);
