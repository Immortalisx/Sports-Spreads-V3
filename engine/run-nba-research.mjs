#!/usr/bin/env node
import {collectNbaResearch} from './nba-boxscorelab.mjs';
import {evaluateRetrospective} from './retrospective-model.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
const seasons=['2022-23','2023-24','2024-25','2025-26'];
const games=await collectNbaResearch(seasons);
const result={...evaluateRetrospective(games,'nba'),study:{
 source:'https://boxscorelab.com/downloads/',sourceLicense:'CC BY 4.0',
 attribution:'BoxScore Lab, boxscorelab.com, data published through November 16, 2026',
 seasons,attemptedGames:games.length,generatedAt:new Date().toISOString(),
 mode:'historical completed results, not recorded pregame odds, lineups, injuries or forecasts'
}};
const filename=process.argv.find(x=>x.startsWith('--output='))?.slice(9)||'research/nba-out-of-time.json';
const dst=resolve(filename);await mkdir(dirname(dst),{recursive:true});await writeFile(dst,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
