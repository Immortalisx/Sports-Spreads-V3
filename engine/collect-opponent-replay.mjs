#!/usr/bin/env node
/**
 * No-key historical research replay. Runs only in manually triggered CI.
 * NHL uses bounded official club-schedule GETs (32 per season).
 * NBA requires an attributed offline input; no unlimited day-by-day API scan.
 */
import {writeFile,mkdir} from 'node:fs/promises';
import {collectHistorical,nflFromCsv} from './historical-sources.mjs';
import {evaluateOpponentFactors} from './opponent-adjusted-research.mjs';
import {validateRecency} from './recency-research.mjs';
const league=process.argv[2];
if(!['nfl','nhl'].includes(league))throw Error('Use nfl or nhl. NBA requires verified offline source.');
const seasons=league==='nfl'?[2021,2022,2023,2024,2025]:[2022,2023,2024,2025];
let games=[];
if(league==='nfl'){
 const r=await fetch('https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv',{signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw Error('NFL HTTP '+r.status);
 const csv=await r.text();
 for(const year of seasons)games.push(...nflFromCsv(csv,year));
}else{
 for(const year of seasons){
  const rows=await collectHistorical({league,season:year,onProgress:x=>{if(x.error)console.error(year,x.club,x.error);}});
  games.push(...rows);
 }
}
const counts=Object.fromEntries(seasons.map(s=>[s,games.filter(g=>g.season===s).length]));
const minima=league==='nfl'?125:800;
if(seasons.some(s=>counts[s]<minima))throw Error('Incomplete '+league+' historical coverage: '+JSON.stringify(counts)+'. Reject partial replay instead of reporting success.');
const report={league,source:league==='nfl'?'nflverse community CSV':'official NHL club schedules',
 fetchedAt:new Date().toISOString(),games:games.length,bySeason:Object.fromEntries(seasons.map(s=>[s,games.filter(g=>g.season===s).length])),
 opponent:evaluateOpponentFactors(games,league),recency:validateRecency(games,league),
 promotionAllowed:false};
await mkdir('research',{recursive:true});
await writeFile('research/'+league+'-opponent-replay.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
