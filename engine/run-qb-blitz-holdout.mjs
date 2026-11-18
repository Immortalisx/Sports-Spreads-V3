#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {evaluateQbBlitzIncrement} from './evaluate-qb-blitz-holdout.mjs';
const input=resolve(process.argv.find(x=>x.startsWith('--input='))?.slice(8)||'research/nfl-qb-blitz-history.json');
const target=resolve(process.argv.find(x=>x.startsWith('--output='))?.slice(9)||'research/nfl-qb-blitz-holdout.json');
const history=JSON.parse(await readFile(input,'utf8'));
if(history.metadata?.status!=='source_integrity_verified'||history.metadata?.modelPromoted!==false||
 !Array.isArray(history.games)||!Array.isArray(history.features))throw Error('Incomplete or unreliable FTN research history');
for(const year of ['2022','2023','2024','2025']){
 if(!history.metadata.seasons?.[year]||history.metadata.seasons[year].coverage<.95)
  throw Error('Missing documented play-join coverage for '+year);
}
const result=evaluateQbBlitzIncrement(history.games,history.features);
const report={...result,generatedAt:new Date().toISOString(),
 originalSourceCoverage:history.metadata.seasons,
 sourceFingerprint:history.metadata.sourceHashes};
await mkdir(dirname(target),{recursive:true});
await writeFile(target,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:result.status,approved:result.approved,counts:result.counts,
 selectedForm:result.selection?.recentForm,selectedWithQB:result.selection?.withQBBlitz,
 sampleCoverage:result.sourceCoverage,
 brierForm:result.metrics?.recentFormOnly.brier,brierWithQB:result.metrics?.withQBBlitz.brier,
 eceForm:result.metrics?.recentFormOnly.ece,eceWithQB:result.metrics?.withQBBlitz.ece,
 brierGain:result.metrics?.brierGain,blockCI:result.metrics?.pairedBootstrap,
 checks:result.checks},null,2));
