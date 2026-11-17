import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBoxscoreLabGames,collectNbaResearch} from '../engine/nba-boxscorelab.mjs';
const CSV='season,team,game_date,matchup,opponent,home,result,points,opponent_points,point_diff\n'+
'2022-23,ATL,2023-04-09,ATL @ BOS,BOS,False,L,114,120,-6\n'+
'2022-23,BOS,2023-04-09,BOS vs ATL,ATL,True,W,120,114,6\n';
test('public CC BY NBA logs produce one result per home/away paired game',()=>{
 const r=parseBoxscoreLabGames(CSV,'2022-23');
 assert.equal(r.length,1);assert.equal(r[0].homeTeam,'BOS');assert.equal(r[0].awayTeam,'ATL');
 assert.equal(r[0].season,2022);assert.equal(r[0].homeScore,120);assert.match(r[0].sourceUrl,/boxscorelab/);
});
test('parser rejects missing pairs, score mismatches, duplicate teams and wrong seasons',()=>{
 assert.throws(()=>parseBoxscoreLabGames(CSV.split('\n').slice(0,2).join('\n'),'2022-23'),/pair|coverage/);
 assert.throws(()=>parseBoxscoreLabGames(CSV.replace('True,W,120,114','True,W,120,110'),'2022-23'),/pair/);
 assert.throws(()=>parseBoxscoreLabGames(CSV+CSV.split('\n')[1]+'\n','2022-23'),/Duplicate/);
 assert.throws(()=>parseBoxscoreLabGames(CSV,'2029-30'),/Invalid NBA game row/);
});
test('research collector accepts limited seasons and does not repeatedly scrape one game per endpoint',async()=>{
 const calls=[];const mock=async url=>{calls.push(url);return {ok:true,text:async()=>CSV};};
 const games=await collectNbaResearch(['2022-23','2022-23','2022-23'],{fetchImpl:mock});
 assert.equal(games.length,3);assert.equal(calls.length,3);
 assert.ok(calls.every(url=>url.startsWith('https://')));
 await assert.rejects(()=>collectNbaResearch(Array(30).fill('2022-23'),{fetchImpl:mock}),/bounded/);
});

test('research parser reports a single orphaned away record without fabricating a final score',()=>{
 const lines=['season,team,game_date,matchup,opponent,home,result,points,opponent_points,point_diff'];
 for(let i=0;i<300;i++){
  const date='2023-03-'+String(1+Math.floor(i/10)).padStart(2,'0');
  const a='A'+String.fromCharCode(65+i%10)+'X',b='B'+String.fromCharCode(65+i%10)+'Y';
  lines.push('2022-23,'+a+','+date+',test,'+b+',True,W,120,110,10');
  lines.push('2022-23,'+b+','+date+',test,'+a+',False,L,110,120,-10');
 }
 lines.push('2022-23,NYK,2023-04-09,test,BOS,False,L,99,102,-3');
 const games=parseBoxscoreLabGames(lines.join('\n'),'2022-23');
 assert.equal(games.length,300);
 assert.equal(games.rejectedTeamRows,1);
 assert.equal(games.totalTeamRows,601);
});
