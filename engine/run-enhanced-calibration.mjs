#!/usr/bin/env node
import {collectHistorical,nflFromCsv} from './historical-sources.mjs';
import {evaluateEnhancedGames} from './calibrate-elo-model.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
const league=process.argv.find(x=>x.startsWith('--league='))?.split('=')[1];
if(!['nfl','nhl'].includes(league))throw Error('Supported: --league=nfl or --league=nhl');
const filepath=resolve(process.argv.find(x=>x.startsWith('--output='))?.slice(9)||'research/enhanced-'+league+'.json');
const games=[];
if(league==='nfl'){
 const r=await fetch('https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv',{signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('NFL public results unavailable: '+r.status);
 const csv=await r.text();
 if(csv.length>20000000)throw Error('NFL CSV unexpected size');
 for(let season=2020;season<=2025;season++){
  const rows=nflFromCsv(csv,season);console.error('Loaded NFL',season,rows.length);games.push(...rows);
 }
}else{
 for(let season=2021;season<=2025;season++){
  const diagnosticFetch=async(url,opts)=>{
   const response=await fetch(url,opts);
   if(season===2025&&response.ok){
    try{
     const body=await response.clone().json();
     const games=body.games||[];
     const counted={};for(const g of games)counted[String(g.gameState||'unknown')]=(counted[String(g.gameState||'unknown')]||0)+1;
     console.error('NHL club source',url.split('/').at(-2),season,games.length,
      games[0]?.gameDate,games.at(-1)?.gameDate,JSON.stringify(counted));
    }catch(e){console.error('Club diagnostics unavailable',String(e));}
   }
   return response;
  };
  const rows=await collectHistorical({league:'nhl',season,fetchImpl:diagnosticFetch,
   onProgress:event=>{if(event.error)console.error('NHL source warning:',event.club||event.season,event.error);}});
  console.error('Loaded NHL',season,rows.length);games.push(...rows);
 }
}
const result=evaluateEnhancedGames(games,league);
const report={...result,createdAt:new Date().toISOString(),inputGames:games.length,
 provider:league==='nfl'?'nflverse/nfldata results':'NHL Web API completed game schedule',
 rawResultsRedistributed:false};
await mkdir(dirname(filepath),{recursive:true});await writeFile(filepath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({league,status:report.status,approved:report.approved,counts:report.counts,
 chosen:report.chosen,checks:report.checks,score:report.holdout&&{
  brier:report.holdout.candidate.brier,ece:report.holdout.candidate.ece,
  recordBrier:report.holdout.recordReference.brier,
  constantBrier:report.holdout.constantHome.brier,
  brierGainOverRecord:report.holdout.gainOverRecord,
  gainInterval:report.holdout.bootstrap95GainOverRecord}},null,2));
