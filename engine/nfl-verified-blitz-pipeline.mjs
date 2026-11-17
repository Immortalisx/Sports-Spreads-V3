/**
 * Point-in-time NFL quarterback / receiver-versus-blitz research features.
 * Joins REAL nflverse PBP + FTN's published pass-rush/blitz charting.
 * Source: https://github.com/nflverse/nflverse-data/releases (FTN charting: CC-BY-SA 4.0)
 * Pure data transform: never calls data providers from a user browser, never
 * guesses man/zone coverage (those fields are NOT in the FTN 29-field release),
 * never generates calibrated win odds by itself.
 */
export const NFL_BLITZ_FEATURE_VERSION='nfl-blitz-source-gated-v1';
const MAX_EPA=9;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const id=x=>typeof x==='string'?x.trim():Number.isSafeInteger(x)?String(x):'';
const iso=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\d$/.test(x)?x:null;
const key=(g,p)=>id(g)+'|'+id(p);
const avg=(a)=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
function gamesFromPbp(pbp){
 const grouped=new Map();
 for(const p of pbp){
  if(!id(p.game_id)||!iso(p.game_date)||!id(p.posteam)||!id(p.defteam))continue;
  if(!grouped.has(p.game_id))grouped.set(p.game_id,{date:p.game_date,teams:new Set()});
  grouped.get(p.game_id).teams.add(p.posteam);grouped.get(p.game_id).teams.add(p.defteam);
 }
 return grouped;
}
export function joinBlitzPlays({pbp,ftn}){
 if(!Array.isArray(pbp)||!Array.isArray(ftn))throw Error('NFL play datasets must be arrays');
 const lookup=new Map(),joined=[],seen=new Set(),errors=[];
 for(const chart of ftn){
  const k=key(chart.nflverse_game_id,chart.nflverse_play_id);
  if(!id(chart.nflverse_game_id)||!id(chart.nflverse_play_id))continue;
  if(lookup.has(k)){errors.push('duplicate_ftn_key:'+k);continue;}
  if(!Number.isInteger(Number(chart.n_blitzers))||Number(chart.n_blitzers)<0||Number(chart.n_blitzers)>12)continue;
  lookup.set(k,chart);
 }
 for(const p of pbp){
  const k=key(p.game_id,p.play_id);
  if(seen.has(k))continue;
  seen.add(k);
  const f=lookup.get(k);
  if(!f||!iso(p.game_date)||!id(p.posteam)||!id(p.defteam)||
    !id(p.passer_player_id)||!finite(Number(p.epa))||
    Math.abs(Number(p.epa))>MAX_EPA||
    !(Number(p.pass_attempt)===1||Number(p.sack)===1||p.play_type==='pass'))continue;
  joined.push({gameId:id(p.game_id),playId:id(p.play_id),date:p.game_date,
   offenseTeam:id(p.posteam),defenseTeam:id(p.defteam),
   quarterbackId:id(p.passer_player_id),receiverId:id(p.receiver_player_id)||null,
   epa:Number(p.epa),blitz:Number(f.n_blitzers)>=1,
   catchable:f.is_catchable_ball===true||f.is_catchable_ball==='TRUE',
   drop:f.is_drop===true||f.is_drop==='TRUE',
   source:'FTN via nflverse + nflverse play_by_play',license:'CC-BY-SA-4.0'});
 }
 return {version:NFL_BLITZ_FEATURE_VERSION,joined,matched:joined.length,
  ftnTotal:ftn.length,pbpTotal:pbp.length,chartCoverage:ftn.length?joined.length/ftn.length:0,
  qualityWarnings:errors,coverageScheme:'unavailable',notes:'FTN public charting includes n_blitzers, not a verified man/zone/CB assignment.'};
}
/** For each game, return ONLY data from games on strictly earlier calendar dates.
 * Game rows may be in any input order. Same-day doubleheaders don't leak.
 */
export function buildBlitzPregameFeatures({plays,fixtures,minQb=35,minDefense=60,minReceiver=12}){
 if(!Array.isArray(plays)||!Array.isArray(fixtures))throw Error('Expected scored plays and future games');
 const sorted=[...fixtures].sort((a,b)=>String(a.date).localeCompare(String(b.date))||id(a.gameId).localeCompare(id(b.gameId)));
 const safe=[...plays].filter(p=>iso(p.date)&&id(p.gameId)&&id(p.quarterbackId)&&
  id(p.offenseTeam)&&id(p.defenseTeam)&&finite(p.epa)&&typeof p.blitz==='boolean')
  .sort((a,b)=>a.date.localeCompare(b.date)||a.gameId.localeCompare(b.gameId));
 const byQb=new Map(),byReceiver=new Map(),byDefense=new Map();
 let cursor=0;
 const add=(map,k,p)=>{const a=map.get(k)||[];a.push(p);map.set(k,a);};
 const result=[];
 for(const g of sorted){
  if(!iso(g.date)||!id(g.gameId))throw Error('A fixture needs an actual date and game ID');
  // Apply completed play observations from dates strictly BEFORE this fixture.
  while(cursor<safe.length&&safe[cursor].date<g.date){
   const p=safe[cursor++];
   add(byQb,p.quarterbackId,p);
   add(byDefense,p.defenseTeam,p);
   if(p.receiverId)add(byReceiver,p.receiverId,p);
  }
  const side=(team,opponent,qb,receiver)=>{
   const q=(byQb.get(id(qb))||[]).filter(p=>p.offenseTeam===team);
   const def=byDefense.get(opponent)||[];
   const rec=receiver?(byReceiver.get(id(receiver))||[]).filter(p=>p.offenseTeam===team):[];
   const qbBlitz=q.filter(p=>p.blitz),qbBase=q.filter(p=>!p.blitz);
   const receiverBlitz=rec.filter(p=>p.blitz),receiverBase=rec.filter(p=>!p.blitz);
   const defenseRate=def.length?def.filter(p=>p.blitz).length/def.length:null;
   return {quarterbackId:id(qb)||null,receiverId:id(receiver)||null,
    sourceDataThrough:q.length||def.length?
      [...q,...def].map(x=>x.date).sort().at(-1):null,
    qbBlitzPlays:qbBlitz.length,qbNonBlitzPlays:qbBase.length,
    opponentRushSamples:def.length,receiverBlitzTargets:receiverBlitz.length,
    qbEpaVsBlitz:qbBlitz.length>=minQb?avg(qbBlitz.map(x=>x.epa)):null,
    qbEpaVsNonBlitz:qbBase.length>=minQb?avg(qbBase.map(x=>x.epa)):null,
    opponentBlitzRate:def.length>=minDefense?defenseRate:null,
    receiverEpaVsBlitz:receiverBlitz.length>=minReceiver?avg(receiverBlitz.map(x=>x.epa)):null,
    receiverEpaVsNonBlitz:receiverBase.length>=minReceiver?avg(receiverBase.map(x=>x.epa)):null,
    receiverVsMan:null,receiverVsZone:null,coverageStatus:'no_verified_man_zone_data',
    availability:(qbBlitz.length>=minQb&&qbBase.length>=minQb&&def.length>=minDefense)?'sourced':'insufficient_samples'};
  };
  const home=side(g.homeTeam,g.awayTeam,g.homeQbId,g.homeReceiverId);
  const away=side(g.awayTeam,g.homeTeam,g.awayQbId,g.awayReceiverId);
  const predict=(x)=>x.qbEpaVsBlitz!==null&&x.qbEpaVsNonBlitz!==null&&x.opponentBlitzRate!==null?
    x.qbEpaVsBlitz*x.opponentBlitzRate+x.qbEpaVsNonBlitz*(1-x.opponentBlitzRate):null;
  const h=predict(home),a=predict(away);
  result.push({gameId:g.gameId,date:g.date,league:'nfl',home,away,
   blitzEpaInteraction:h!==null&&a!==null?Math.max(-5,Math.min(5,h-a)):null,
   source:'FTN charting via nflverse + nflverse PBP',usableForLive:false,
   note:'Pregame QB/blitz interactions are research inputs, not validated win probabilities.'});
 }
 return result;
}
/**
 * Injuries: only reports genuinely recorded before the kickoff may be attached.
 * "Not listed" is unknown status, never assume healthy or absent.
 */
export function injuryAvailabilityForGame({reports,gameAt,playerIds}){
 const kickoff=Date.parse(gameAt||'');
 if(!Number.isFinite(kickoff)||!Array.isArray(reports)||!Array.isArray(playerIds))throw Error('Invalid dated injury lookup');
 const result=[];
 for(const playerId of playerIds){
  const candidates=reports.filter(x=>id(x.playerId)===id(playerId)&&Number.isFinite(Date.parse(x.reportedAt||''))&&
    Date.parse(x.reportedAt)<kickoff&&typeof x.status==='string').sort((a,b)=>Date.parse(b.reportedAt)-Date.parse(a.reportedAt));
  const r=candidates[0];
  result.push({playerId:id(playerId),status:r?.status||'unknown',
   source:r?.source||null,reportedAt:r?.reportedAt||null,
   matchQuality:r?'dated_report':'not_reported',assumedAvailable:false});
 }
 return result;
}
