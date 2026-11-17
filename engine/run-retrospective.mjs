#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {evaluateRetrospective} from './retrospective-model.mjs';
const args=Object.fromEntries(process.argv.slice(2).filter(x=>x.startsWith('--')).map(s=>{const [k,...v]=s.slice(2).split('=');return [k,v.join('=')];}));
if(!args.input||!args.league){console.error('Usage: node engine/run-retrospective.mjs --input=research/nfl-merged.json --league=nfl [--output=research/report.json]');process.exit(1);}
const input=JSON.parse(await readFile(resolve(args.input),'utf8'));
const games=Array.isArray(input)?input:input.games;
const report=evaluateRetrospective(games,args.league);
if(args.output){await mkdir(dirname(resolve(args.output)),{recursive:true});await writeFile(resolve(args.output),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));
if(!['research_only','insufficient_seasons','insufficient_sample','insufficient_feature_coverage'].includes(report.status))process.exitCode=1;
