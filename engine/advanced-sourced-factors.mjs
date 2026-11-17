/** Sports Spreads: typed, opponent-aware inputs for four-sport model research.
 * Sourced factors from pregame observations, NEVER guesses or automatically published coefficients.
 * These are *candidate features* for chronological training, NOT validated win probabilities.
 */
import {validatePregameEvidence} from './pregame-evidence.mjs';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const required=(x,label)=>{if(!finite(x))throw Error('Missing sourced '+label);return x;};
const cap=x=>Math.max(-5,Math.min(5,x));
const rate=(x,label)=>{required(x,label);if(x<0||x>1)throw Error('Invalid sourced '+label);return x;};
const pair=(home,away,label)=>{if(!home||!away)throw Error('Both teams required for '+label);};
const delta=(home,away)=>cap(home-away);
function nflBlitz(side){return required(side.qbBlitzEpa,'QB blitz EPA')*rate(side.opponentBlitzRate,'defensive blitz rate')+
  required(side.qbCleanEpa,'clean pocket EPA')*(1-side.opponentBlitzRate)+.25*required(side.opponentPressureEpaAllowed,'opponent pressure response');}
function nflCoverage(side){return required(side.qbManEpa,'QB man coverage EPA')*rate(side.opponentManRate,'defensive man rate')+
  required(side.qbZoneEpa,'QB zone coverage EPA')*(1-side.opponentManRate);}
function nbaScheme(side){const sw=rate(side.opponentSwitchRate,'switch share'),zone=rate(side.opponentZoneRate,'zone share');if(sw+zone>1)throw Error('Defensive scheme shares exceed one');
 return sw*required(side.offenseVsSwitch,'offense vs switch')+zone*required(side.offenseVsZone,'offense vs zone')+
 (1-sw-zone)*required(side.offenseVsOther,'offense versus other defenses');}
function nhlGoalie(side){if(!side.confirmedStarterId)throw Error('Confirmed goalie identity required');return required(side.goalieGsaxPer60,'goalie goals-saved-above-expected per 60');}
function mlbPitcherHitter(side){if(!side.opposingStarterId||!Array.isArray(side.projectedHitterIds)||side.projectedHitterIds.length<7)throw Error('Starter and projected lineup required');
 // The pregame lineup-weighted xwOBA estimate must be sourced from pitch mix + handedness splits,
 // not a career head-to-head average of a tiny number of at-bats.
 const x=required(side.lineupXwobaAgainstPitchMix,'lineup expected wOBA');if(x<0||x>1)throw Error('Invalid expected wOBA');return x*10;}
const computations={
 nfl:{qb_blitz_edge:nflBlitz,coverage_edge:nflCoverage},
 nba:{scheme_edge:nbaScheme},
 nhl:{goalie_gsax:nhlGoalie},
 mlb:{pitcher_hitter:mlbPitcherHitter}
};
/** Each observation has a vetted URL/timestamp, both matchups and a meaningful sample. */
export function computeCandidateFeature(game,{featureId,home,away,sampleSize,sourceTier,sourceUrl,snapshotAt,dataThrough,matchup}){
 const fn=computations[game?.league]?.[featureId];if(!fn)throw Error('Unsupported matchup calculation');
 pair(home,away,featureId);
 const homeMinusAway=delta(fn(home),fn(away));
 const item={gameId:game.gameId,league:game.league,featureId,homeMinusAway,sampleSize,sourceTier,sourceUrl,snapshotAt,dataThrough,matchup};
 const validated=validatePregameEvidence(item,game);
 if(!validated.ok)throw Error(validated.reason);
 return {...item,calculation:'opponent_relative_candidate',appliedToLiveProbability:false};
}
/** Coaching H2H intentionally DESCRIPTIVE, not a causal measure of coaching quality. */
export function coachingHeadToHead({meetings,homeCoachWins,homeCoachId,awayCoachId}){
 if(!Number.isInteger(meetings)||meetings<0||!Number.isInteger(homeCoachWins)||homeCoachWins<0||homeCoachWins>meetings||!homeCoachId||!awayCoachId)throw Error('Verified head-coach meetings required');
 const dampedHome=(homeCoachWins+4)/(meetings+8); // shrink toward 50% to prevent tiny samples dominating.
 return {meetings,homeCoachWins,awayCoachWins:meetings-homeCoachWins,shrunkHistoricalWinShare:dampedHome,notCausal:true,appliedToLiveProbability:false};
}
export const SUPPORTED_RESEARCH_FEATURES=Object.freeze(Object.fromEntries(Object.entries(computations).map(([sport,x])=>[sport,Object.keys(x)])));
