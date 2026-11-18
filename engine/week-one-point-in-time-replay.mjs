/** Offline Week 1 replay: results are never passed into the prediction engine.
 * Requires an archived, attributed, timestamped pre-kickoff baseline and
 * validated multifactor manifest. No invented predictions or odds.
 */
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const sandbox={Date};sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL('../public/multifactor-engine.js',import.meta.url),'utf8'),sandbox);
const model=sandbox.SportsMultifactor;
export function replayWeekOne(games,snapshots=[]){
 if(!Array.isArray(games)||!Array.isArray(snapshots))throw Error('arrays required');
 const seen=new Set();
 return games.map(g=>{
  if(!['nfl','nba','nhl'].includes(g.league)||!g.gameId||seen.has(g.gameId))throw Error('invalid or duplicate game');
  seen.add(g.gameId);
  const start=Date.parse(g.start);
  if(!Number.isFinite(start)||!Number.isInteger(g.homeScore)||!Number.isInteger(g.awayScore)||g.homeScore<0||g.awayScore<0||g.homeScore===g.awayScore||!/^https:\/\//.test(g.resultSource))throw Error('invalid result fixture');
  const outcome={homeScore:g.homeScore,awayScore:g.awayScore,homeWon:g.homeScore>g.awayScore};
  const s=snapshots.find(x=>x.gameId===g.gameId);
  const base={league:g.league,gameId:g.gameId,home:g.home,away:g.away,start:g.start,outcome,promotionAllowed:false};
  if(!s)return {...base,status:'not_independently_testable',reason:'missing_archived_pregame_snapshot',prediction:null};
  const captured=Date.parse(s.snapshotAt);
  if(!Number.isFinite(captured)||captured>=start||!/^https:\/\//.test(s.sourceUrl||''))return {...base,status:'not_independently_testable',reason:'invalid_snapshot_provenance_or_time',prediction:null};
  if(!s.baseline?.available||!Number.isFinite(s.baseline.homeProbability)||s.baseline.homeProbability<=0||s.baseline.homeProbability>=1)return {...base,status:'not_independently_testable',reason:'missing_pregame_baseline',prediction:null};
  // This is the actual production multifactor contract, not a made-up surrogate.
  // Critically: only pregame inputs enter estimate; final score is compared afterward.
  const evidence=s.evidence||{};
  if(Object.values(evidence).some(x=>!x||!Number.isFinite(Date.parse(x.asOf))||Date.parse(x.asOf)>captured||!Number.isFinite(Date.parse(x.dataThrough))||Date.parse(x.dataThrough)>captured))return {...base,status:'not_independently_testable',reason:'feature_snapshot_leakage',prediction:null};
  const result=model.estimate({league:g.league,start:g.start},s.baseline,evidence,s.manifest);
  if(!result.validated||!Number.isFinite(result.probability))return {...base,status:'not_independently_testable',reason:result.reason||'no_validated_pregame_model_manifest_or_features',prediction:null};
  const p=result.probability;
  return {...base,status:'scored_research_only',prediction:{homeWinProbability:p,modelVersion:result.modelVersion},evaluation:{winnerCorrect:(p>=.5)===outcome.homeWon,brier:(p-(outcome.homeWon?1:0))**2}};
 });
}
