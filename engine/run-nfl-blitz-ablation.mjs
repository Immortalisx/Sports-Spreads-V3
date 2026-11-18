#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {evaluateNflBlitzAblation} from './evaluate-nfl-blitz-ablation.mjs';
const file=process.argv.find(x=>x.startsWith('--input='))?.slice(8)||'research/nfl-qb-blitz-pregame-aggregate.json';
const src=JSON.parse(await readFile(file,'utf8'));
const report={...evaluateNflBlitzAblation(src),generatedAt:new Date().toISOString(),
 sourceCoverage:src.coverage,sourceScans:src.joinedCoverage,
 rawPlayDataPublished:false,providerCreditsUsed:0};
await mkdir('research',{recursive:true});
await writeFile('research/nfl-blitz-ablation-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,approved:report.approved,
 selectedOnlyOn:'2023',modelCalibrationOnlyOn:'2024',holdoutOnly:'2025',
 counts:report.counts,checks:report.checks,blitzDataCoverage:report.holdout?.availableCoverage,
 baselineBrier:report.holdout?.baseline?.brier,
 blitzBrier:report.holdout?.augmented?.brier,
 calibrationECE:report.holdout?.augmented?.ece,
 gain:report.holdout?.brierGain,confidenceInterval:report.holdout?.paired95BrierGain,
 noProductionPromotion:true},null,2));
