import test from 'node:test';
import assert from 'node:assert/strict';
import {server} from '../server.mjs';

test('API serves three leagues, normalized games, team reports, and useful input errors',async()=>{
  const nativeFetch=globalThis.fetch;
  globalThis.fetch=async(input,opts)=>{
    const address=String(input);
    if(!address.startsWith('https://site.api.espn.com'))return nativeFetch(input,opts);
    const u=new URL(address);
    let payload={};
    if(u.pathname.endsWith('/scoreboard')) payload={events:[{id:'987654321',date:'2026-11-17T22:00:00Z',status:{type:{state:'pre',shortDetail:'Scheduled'}},competitions:[{competitors:[{homeAway:'home',team:{id:'28',displayName:'Toronto Raptors',abbreviation:'TOR'}},{homeAway:'away',team:{id:'18',displayName:'New York Knicks',abbreviation:'NY'}}]}]}]};
    else if(u.pathname.endsWith('/injuries'))payload={teams:[{id:'28',injuries:[{athlete:{id:'1',displayName:'Example Player'},status:'Questionable'}]}]};
    else if(u.pathname.endsWith('/roster'))payload={athletes:[{items:[{id:'8',displayName:'Example Forward',position:{abbreviation:'F'}}]}]};
    else if(u.pathname.endsWith('/news'))payload={articles:[{headline:'Toronto Raptors prepare for matchup',links:{web:{href:'https://www.espn.com/'}}}]};
    else if(u.pathname.endsWith('/teams/28'))payload={team:{id:'28',displayName:'Toronto Raptors'}};
    else if(u.pathname.endsWith('/teams'))payload={sports:[{leagues:[{teams:[{team:{id:'28',displayName:'Toronto Raptors'}}]}]}]};
    return {ok:true,json:async()=>payload};
  };
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    const status=await(await nativeFetch(base+'/api/status')).json();
    assert.equal(status.leagues.length,3);
    assert.equal(status.modelConnected,false);
    const board=await(await nativeFetch(base+'/api/scoreboard?league=nba&date=20261117')).json();
    assert.equal(board.games.length,1);assert.equal(board.games[0].home.name,'Toronto Raptors');assert.equal(board.games[0].model,null);
    const roster=await(await nativeFetch(base+'/api/team/nba/28?view=roster')).json();
    assert.equal(roster.roster[0].name,'Example Forward');
    const injuries=await(await nativeFetch(base+'/api/team/nba/28?view=injuries')).json();
    assert.equal(injuries.injuries[0].status,'Questionable');
    const news=await(await nativeFetch(base+'/api/team/nba/28?view=news&name=Toronto%20Raptors')).json();
    assert.equal(news.scope,'team-related');
    const invalid=await nativeFetch(base+'/api/team/nba/not-an-id?view=roster');
    assert.equal(invalid.status,400);
    const unknown=await nativeFetch(base+'/api/scoreboard?league=soccer');
    assert.equal(unknown.status,400);
    const homepage=await nativeFetch(base+'/');
    assert.equal(homepage.status,200);assert.match(await homepage.text(),/Sports Spreads/);
  } finally {
    globalThis.fetch=nativeFetch;
    await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  }
});
