#!/usr/bin/env node
// Manual, bounded, no-key historical results fetch. Stored locally; not a live API.
import {collectHistorical,SOURCE_REGISTRY} from './historical-sources.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
const opts=Object.fromEntries(process.argv.slice(2).filter(s=>s.startsWith('--')).map(s=>{const [k,...v]=s.slice(2).split('=');return [k,v.join('=')];}));
const league=opts.league||'nfl',season=Number(opts.season||2025);
const output=resolve(opts.output||`research/${league}-${season}.json`);
if(!SOURCE_REGISTRY[league]){console.error('Choose --league=nfl|nba|nhl|mlb');process.exit(1);}
const rows=await collectHistorical({league,season,start:opts.start,end:opts.end,maxDays:Number(opts.maxDays||31),onProgress:e=>{if(e.error)console.warn('Source unavailable',e.league,e.club||e.date,e.error);}});
await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify({source:SOURCE_REGISTRY[league],fetchedAt:new Date().toISOString(),mode:'retrospective_game_results_only',games:rows},null,2)+'\n');
console.log(JSON.stringify({status:'downloaded_for_research_only',league,season,rows:rows.length,path:output,source:SOURCE_REGISTRY[league].url,warning:'Historical results cannot prove point-in-time QB, pitch or lineup features.'},null,2));
