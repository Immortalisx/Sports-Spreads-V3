#!/usr/bin/env node
import {nflFromCsv} from './historical-sources.mjs';
import {fetchNhlSeasonListing} from './nhl-bulk-history.mjs';
import {evaluateRollingFormHoldout} from './validate-rolling-form.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
const league=process.argv.find(s=>s.startsWith('--league='))?.split('=')[1];
if(!['nfl','nhl'].includes(league))throw Error('Supported --league=nfl or --league=nhl');
const path=resolve(process.argv.find(s=>s.startsWith('--output='))?.slice(9)||'research/rolling-'+league+'.json');
const games=[];
if(league==='nfl'){
 const response=await fetch('https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv',
  {signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('NFL historical source unavailable HTTP '+response.status);
 const csv=await response.text();
 if(csv.length>20000000)throw Error('NFL source unexpectedly large');
 for(let year=2020;year<=2025;year++){
  const rows=nflFromCsv(csv,year);
  console.error('NFL',year,rows.length);games.push(...rows);
 }
}else{
 for(let year=2021;year<=2025;year++){
  const {games:rows,coverage}=await fetchNhlSeasonListing(year);
  if(!coverage.complete||rows.length!==1312)throw Error('Incomplete official NHL season '+year);
  console.error('NHL',year,rows.length);games.push(...rows);
 }
}
const study=evaluateRollingFormHoldout(games,league);
const report={...study,generatedAt:new Date().toISOString(),sourceGames:games.length};
await mkdir(dirname(path),{recursive:true});
await writeFile(path,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({league,status:report.status,approved:report.approved,
 counts:report.counts,selectedFeatures:report.selectedFeatures,checks:report.checks,
 candidateBrier:report.holdout?.candidate?.brier,
 recordBrier:report.holdout?.recordBenchmark?.brier,
 ece:report.holdout?.candidate?.ece,gain:report.holdout?.brierGain,
 pairedInterval:report.holdout?.paired95GainCI},null,2));
