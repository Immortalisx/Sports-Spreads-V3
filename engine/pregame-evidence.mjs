/** Verifiable, point-in-time advanced matchup evidence staging. Strict by design.
 * Do not merge postgame statistics into historical features or treat coach H2H
 * as proof of tactical superiority. This is an import gate, NOT model weights.
 */
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const ctx={Date};ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../public/multifactor-engine.js',import.meta.url),'utf8'),ctx);
const featureDefs=ctx.SportsMultifactor.CATALOG;
const tiers=new Set(['official','licensed','independently_verified']);
const validIso=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))&&/\d{4}-\d\d-\d\dT/.test(s);
export function validatePregameEvidence(item,game){
 if(!item||!game||item.gameId!==game.gameId||item.league!==game.league)return {ok:false,reason:'Wrong game or league'};
 const spec=(featureDefs[item.league]||[]).find(x=>x[0]===item.featureId);
 if(!spec)return {ok:false,reason:'Unknown factor'};
 if(!tiers.has(item.sourceTier)||!/^https:\/\//.test(item.sourceUrl||''))return {ok:false,reason:'Unverified source'};
 if(!Number.isFinite(item.homeMinusAway)||Math.abs(item.homeMinusAway)>5||!Number.isInteger(item.sampleSize)||item.sampleSize<spec[2])return {ok:false,reason:'Insufficient statistical evidence'};
 if(!validIso(item.snapshotAt)||!validIso(item.dataThrough)||!validIso(game.gameAt))return {ok:false,reason:'Missing timestamp'};
 const snap=Date.parse(item.snapshotAt),through=Date.parse(item.dataThrough),kickoff=Date.parse(game.gameAt);
 if(snap>=kickoff||through>snap||through>=kickoff)return {ok:false,reason:'Data after kickoff (leakage)'};
 if(item.league==='nfl'&&['qb_blitz_edge','coverage_edge'].includes(item.featureId)&&!item.matchup?.quarterbackId)return {ok:false,reason:'Quarterback identity required'};
 if(item.league==='mlb'&&item.featureId==='pitcher_hitter'&&(!item.matchup?.startingPitcherId||!Array.isArray(item.matchup?.projectedHitterIds)||item.matchup.projectedHitterIds.length<7))return {ok:false,reason:'Named starting pitcher and at least 7 expected hitters required'};
 if(item.league==='nhl'&&item.featureId==='goalie_gsax'&&!item.matchup?.confirmedStarterId)return {ok:false,reason:'Starting goalie confirmation required'};
 return {ok:true,id:item.featureId,sampleSize:item.sampleSize,sourceUrl:item.sourceUrl,snapshotAt:item.snapshotAt};
}
export function stageEvidence(games,observations){
 if(!Array.isArray(games)||!Array.isArray(observations))throw Error('Expected arrays');
 const byId=new Map(games.map(x=>[x.gameId,x]));const accepted=[],rejected=[],seen=new Set();
 for(const item of observations){
  const check=validatePregameEvidence(item,byId.get(item?.gameId));
  const key=`${item?.gameId}:${item?.featureId}:${item?.snapshotAt}`;
  if(seen.has(key)){rejected.push({gameId:item?.gameId,featureId:item?.featureId,reason:'Duplicate evidence'});continue;}
  seen.add(key);
  if(check.ok)accepted.push(item);else rejected.push({gameId:item?.gameId,featureId:item?.featureId,reason:check.reason});
 }
 return {contractVersion:ctx.SportsMultifactor.VERSION,status:'research_staging_only',accepted,rejected,sourceRequirements:'Official, licensed or independently verified; captured strictly before kickoff; no post-game stats.'};
}
