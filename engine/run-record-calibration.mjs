#!/usr/bin/env node
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {collectHistorical,nflFromCsv} from './historical-sources.mjs';
import {collectNbaResearch} from './nba-boxscorelab.mjs';
import {calibrateRecordModel} from './calibrate-record-model.mjs';
const league=process.argv.find(x=>x.startsWith('--league='))?.split('=')[1];
if(!['nfl','nba','nhl','mlb'].includes(league))throw Error('Choose --league=nfl|nba|nhl|mlb');
const out=process.argv.find(x=>x.startsWith('--output='))?.slice(9)||'research/record-'+league+'.json';
let games=[];
if(league==='nba')games=await collectNbaResearch(['2022-23','2023-24','2024-25','2025-26']);
else if(league==='nfl'){
 const response=await fetch('https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv',{signal:AbortSignal.timeout(27000)});
 if(!response.ok)throw Error('NFL source HTTP '+response.status);
 const csv=await response.text();if(csv.length>20000000)throw Error('NFL CSV exceeded safe size');
 for(let year=2020;year<=2025;year++)games.push(...nflFromCsv(csv,year));
}else{
 const first=league==='nhl'?2023:2022,last=2025;
 for(let year=first;year<=last;year++){
  const row=await collectHistorical({league,season:year,onProgress:x=>{if(x.error)console.error('Source skipped',x.club||x.date,x.error)}});
  games.push(...row);console.error('Imported',league,year,row.length,'games');
 }
}
const result=calibrateRecordModel(games,league);
const report={...result,generatedAt:new Date().toISOString(),sourceRows:games.length};
await mkdir(dirname(resolve(out)),{recursive:true});await writeFile(resolve(out),JSON.stringify(report,null,2)+'\n');
const {status,approved,splits,holdout,reviewManifest}=report;
console.log(JSON.stringify({league,sourceRows:games.length,status,approved,splits,
 brier:holdout?.candidate?.brier,baselineBrier:holdout?.baseline?.brier,
 gain:holdout?.brierGain,ci:holdout?.bootstrap95PercentGainInterval,
 ece:holdout?.candidate?.ece,bias:holdout?.candidate?.bias,selectedPrior:reviewManifest?.prior},null,2));
