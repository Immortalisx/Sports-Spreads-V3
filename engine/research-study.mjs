#!/usr/bin/env node
/** Run a bounded, reproducible cross-sport study; NEVER auto-deploy weights.
 * NFL: one public CSV download for all requested years.
 * MLB: one schedule GET per season.
 * NHL: one official team schedule per club per season; dedupe games.
 * NBA: explicit dates; max 31 daily calls per invocation by default.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {collectHistorical,nflFromCsv,SOURCE_REGISTRY} from './historical-sources.mjs';
import {evaluateRetrospective} from './retrospective-model.mjs';
const opts=Object.fromEntries(process.argv.slice(2).filter(x=>x.startsWith('--')).map(s=>{const [k,...v]=s.slice(2).split('=');return [k,v.join('=')];}));
const league=opts.league,from=Number(opts.from||2022),to=Number(opts.to||2025);
if(!SOURCE_REGISTRY[league]||!Number.isInteger(from)||!Number.isInteger(to)||from>to||to-from>6){console.error('Usage: node engine/research-study.mjs --league=nfl|mlb|nhl --from=2022 --to=2025 [--input=local-results.json] [--output=research/report.json]. Max 7 seasons. NBA requires separate bounded date pulls.');process.exit(1);}
const source=SOURCE_REGISTRY[league];let games=[];
if(opts.input){const obj=JSON.parse(await readFile(resolve(opts.input),'utf8'));games=Array.isArray(obj)?obj:obj.games;}
else if(league==='nfl'){
 const resp=await fetch('https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv',{signal:AbortSignal.timeout(25000)});
 if(!resp.ok)throw Error('NFL source HTTP '+resp.status);
 const csv=await resp.text();if(csv.length>20_000_000)throw Error('Excessively large NFL feed');
 for(let y=from;y<=to;y++)games.push(...nflFromCsv(csv,y));
}else if(league==='nba')throw Error('NBA uses bounded date scans. Collect per 31-day period with collect-research.mjs, merge JSON locally and pass --input to avoid hundreds of automatic calls.');
else for(let y=from;y<=to;y++){
 console.error(`Retrieving ${league.toUpperCase()} ${y} research results (${source.requestsPerSeason} expected requests/season)`);
 const rows=await collectHistorical({league,season:y,onProgress:x=>{if(x.error)console.error('Skipped source',x.club||x.date,x.error);}});
 games.push(...rows);
}
const report=evaluateRetrospective(games,league);
const result={...report,study:{years:[from,to],source:source.url,originTier:source.tier,attemptedGames:games.length,generatedAt:new Date().toISOString(),mode:'completed-game-only research, not archived pregame predictions'}};
if(opts.output){const target=resolve(opts.output);await mkdir(dirname(target),{recursive:true});await writeFile(target,JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result,null,2));
