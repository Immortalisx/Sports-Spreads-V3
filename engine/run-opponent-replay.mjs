#!/usr/bin/env node
/** Reproducible research-only replay from verified completed-game JSON.
 * Never fetches providers or changes live weights.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {evaluateOpponentFactors} from './opponent-adjusted-research.mjs';
import {validateRecency} from './recency-research.mjs';
const opts=Object.fromEntries(process.argv.slice(2).filter(x=>x.startsWith('--')).map(s=>{
 const [key,...parts]=s.slice(2).split('=');return [key,parts.join('=')];
}));
if(!opts.input||!opts.league||!['nfl','nba','nhl'].includes(opts.league))
 throw Error('Usage: node engine/run-opponent-replay.mjs --league=nfl|nba|nhl --input=verified-games.json [--output=report.json]');
const payload=JSON.parse(await readFile(resolve(opts.input),'utf8'));
const games=Array.isArray(payload)?payload:payload.games;
if(!Array.isArray(games))throw Error('Expected games array');
const opponent=evaluateOpponentFactors(games,opts.league);
const recency=validateRecency(games,opts.league);
const report={league:opts.league,status:'research_only',promotionAllowed:false,
 source:'user-supplied attributed historical final-score records',totalInputGames:games.length,
 opponent,recency,generatedAt:new Date().toISOString(),
 notice:'Not a live or independently verified betting confidence model. Research replay only.'};
if(opts.output){const path=resolve(opts.output);await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));
