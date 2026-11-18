#!/usr/bin/env node
/** Offline research replay integrity gate. No provider calls or production writes. */
import {readFileSync} from 'node:fs';
const league=process.argv[2],path=process.argv[3];
if(!['nfl','nhl'].includes(league)||!path)throw Error('Usage: node engine/verify-opponent-replay.mjs nfl|nhl report.json');
const report=JSON.parse(readFileSync(path,'utf8'));
const fail=(message)=>{throw Error(league+' replay rejected: '+message);};
if(report.league!==league||report.promotionAllowed!==false)fail('league or promotion gate');
if(!Number.isInteger(report.games)||report.games<(league==='nfl'?500:3000))fail('insufficient games');
const expected=league==='nfl'?[2021,2022,2023,2024,2025]:[2022,2023,2024,2025];
for(const season of expected)if(!Number.isInteger(report.bySeason?.[season])||report.bySeason[season]<(league==='nfl'?125:800))fail('season '+season+' incomplete');
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const metric=(x,label)=>{if(!x||!Number.isInteger(x.n)||x.n<1||!finite(x.brier)||x.brier<0||x.brier>1||!finite(x.logLoss)||x.logLoss<0)fail(label+' missing Brier/log loss');};
const interval=(x,label)=>{if(!Array.isArray(x)||x.length!==2||!x.every(finite)||x[0]>x[1])fail(label+' missing 95% interval');};
const opponent=report.opponent,recency=report.recency;
if(opponent?.promotionAllowed!==false||recency?.promotionAllowed!==false)fail('research promotion gate');
if(opponent?.status!=='research_only'||recency?.status!=='research_only')fail('incomplete calibration status');
const o=opponent.holdout,r=recency.holdout;
metric(o?.baseline,'opponent baseline');metric(o?.candidate,'opponent candidate');
metric(r?.baseline,'recency baseline');metric(r?.candidate,'recency candidate');
for(const [x,label] of [[o,'opponent'],[r,'recency']]){
 if(!finite(x.brierGain)||Math.abs(x.brierGain-(x.baseline.brier-x.candidate.brier))>1e-9)fail(label+' Brier gain mismatch');
 interval(x.gameDateBlockBootstrap95,label);
}
for(const label of ['baseline','candidate']){
 const m=r[label];if(!finite(m.ece)||m.ece<0||m.ece>1)fail('recency '+label+' ECE');
}
if(!Number.isInteger(r.baseline.n)||r.baseline.n<(league==='nfl'?125:450))fail('holdout coverage');
console.log(JSON.stringify({league,validated:'research_report_integrity_only',promotionAllowed:false,
 games:report.games,holdout:r.baseline.n,opponent:{brier:o.candidate.brier,logLoss:o.candidate.logLoss,brierGain:o.brierGain,ci95:o.gameDateBlockBootstrap95},
 recency:{brier:r.candidate.brier,logLoss:r.candidate.logLoss,ece:r.candidate.ece,brierGain:r.brierGain,ci95:r.gameDateBlockBootstrap95}},null,2));
