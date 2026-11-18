#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {evaluateQbBlitzHoldout} from './validate-nfl-qb-blitz.mjs';
const input=resolve(process.argv.find(x=>x.startsWith('--input='))?.slice(8)||'research/_temporary-nfl-blitz-aggregates.json');
const output=resolve(process.argv.find(x=>x.startsWith('--output='))?.slice(9)||'research/nfl-qb-blitz-2025-holdout.json');
const data=JSON.parse(await readFile(input,'utf8'));
const report={...evaluateQbBlitzHoldout(data),generatedAt:new Date().toISOString(),
 dataSources:{pbp:'nflverse-data 2022-2025',blitz:'FTN Charting via nflverse (CC BY-SA 4.0)',
 results:'nflverse/nfldata NFL 2022-2025 regular season'},
 sourceSeasons:Object.keys(data.audit||{})};
await mkdir(dirname(output),{recursive:true});
await writeFile(output,JSON.stringify(report,null,2)+'\n');
const {status,approved,counts,selectedBaseFeatures,selectedAdditionalFeatures,holdout,checks,sourceCoverage}=report;
console.log(JSON.stringify({status,approved,counts,selectedBaseFeatures,selectedAdditionalFeatures,
 baseBrier:holdout?.base?.brier,extraBrier:holdout?.enhanced?.brier,
 baselineECE:holdout?.base?.ece,enhancedECE:holdout?.enhanced?.ece,
 gain:holdout?.brierGain,bootstrap95:holdout?.bootstrap95GainCI,
 sourceCoverage,checks},null,2));
