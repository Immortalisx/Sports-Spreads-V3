#!/usr/bin/env node
/* Usage: npm run validate:model -- --input=private/history.json --league=nfl --features=qb_blitz_edge,coverage_edge
 * Intentionally does not generate a production manifest. Outputs research results
 * only, even if the preliminary mathematical gate would pass.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {walkForward,MIN_HOLDOUT} from './walkforward.mjs';
const flags=Object.fromEntries(process.argv.slice(2).filter(x=>x.startsWith('--')).map(x=>{const [key,...v]=x.slice(2).split('=');return [key,v.join('=')];}));
if(!flags.input){console.log(JSON.stringify({status:'no_historical_data',message:'Provide dated point-in-time results and sourced matchup features with --input=file.json. No advanced coefficient is approved for live predictions.'},null,2));process.exit(0);}
let records;try{const raw=await readFile(flags.input,'utf8');records=raw.trim().startsWith('[')?JSON.parse(raw):raw.split(/\r?\n/).filter(Boolean).map(x=>JSON.parse(x));}
catch(e){console.error('Unable to read historical dataset:',e.message);process.exitCode=1;}
if(records){const league=flags.league||'nfl';const features=(flags.features||'').split(',').map(x=>x.trim()).filter(Boolean);
const report=walkForward(records,league,features,{minHoldout:MIN_HOLDOUT[league],allowPromotion:false});
console.log(JSON.stringify(report,null,2));if(flags.output)await writeFile(flags.output,JSON.stringify(report,null,2)+'\n');
if(report.status==='invalid_features'||report.status==='unsupported_league')process.exitCode=1;
}
