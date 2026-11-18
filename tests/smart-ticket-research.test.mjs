import test from 'node:test';
import assert from 'node:assert/strict';
import {auditTicket,confidenceGrade,rankResearchTickets,backtestWholeTickets} from '../engine/smart-ticket-research.mjs';
const now=new Date('2026-11-18T18:00:00Z');
const quotedAt='2026-11-18T17:55:00Z',start='2026-11-18T22:00:00Z';
const leg=(id,gameId,homeTeam,awayTeam)=>({id,gameId,homeTeam,awayTeam,bookmakerKey:'draftkings',odds:-110,oddsAsOf:quotedAt,start});
const ticket={id:'sample',legs:[leg('a','g1','A','B'),leg('b','g2','C','D')]};
const evidence={calibrated:true,prospectiveValidated:true,pointInTimeVerified:true,probability:.35,
 holdoutCount:1100,calibrationBins:10,ece:.012,asOf:quotedAt};
test('uncalibrated evidence never receives a letter grade',()=>{
 for(const patch of [{prospectiveValidated:false},{pointInTimeVerified:false},{ece:.09},{holdoutCount:20},{asOf:'2026-11-16T00:00:00Z'},{probability:1}]){
  assert.equal(confidenceGrade({...evidence,...patch},{now}).grade,null);
 }
 assert.equal(confidenceGrade(evidence,{now}).grade,'A');
});
test('ticket audit checks same book, unique games, team overlap and exact payout',()=>{
 const ok=auditTicket(ticket,{now});
 assert.equal(ok.eligible,true);assert.equal(ok.rankingEligible,false);
 assert.equal(ok.confidence.grade,null);
 assert.ok(Math.abs(ok.payoutMultiplier-(1+100/110)**2)<1e-12);
 assert.equal(ok.returnAt10,Math.round(1000*(1+100/110)**2)/100);
 assert.equal(auditTicket({...ticket,legs:[ticket.legs[0],{...ticket.legs[1],gameId:'g1'}]},{now}).reason,'correlated_same_game');
 assert.equal(auditTicket({...ticket,legs:[ticket.legs[0],{...ticket.legs[1],homeTeam:'A'}]},{now}).reason,'shared_team_exposure');
 assert.equal(auditTicket({...ticket,legs:[ticket.legs[0],{...ticket.legs[1],bookmakerKey:'fanduel'}]},{now}).reason,'mixed_bookmaker');
 assert.equal(auditTicket({...ticket,legs:[ticket.legs[0],{...ticket.legs[1],oddsAsOf:'2026-11-18T17:30:00Z'}]},{now}).reason,'invalid_or_stale_quote');
});
test('research ranking prioritizes only independently validated evidence',()=>{
 const other={...ticket,id:'other'};
 const ranked=rankResearchTickets([other,ticket],{now,evidenceById:{sample:evidence}});
 assert.deepEqual(ranked.map(x=>x.id),['sample','other']);
 assert.equal(ranked[0].audit.rankingEligible,true);
});
test('whole-ticket backtest computes settled returns and Brier without paid sources',()=>{
 const rows=[{id:'1',start,quotedAt,pointInTimeVerified:true,settled:true,won:true,payoutMultiplier:3,predictedJointProbability:.4,independentHoldout:true},
 {id:'2',start,quotedAt,pointInTimeVerified:true,settled:true,won:false,payoutMultiplier:3,predictedJointProbability:.4,independentHoldout:true}];
 const result=backtestWholeTickets(rows);
 assert.equal(result.status,'research_only');assert.equal(result.n,2);
 assert.equal(result.winRate,.5);assert.equal(result.roi,.5);
 assert.ok(Math.abs(result.brier-.26)<1e-12);
 assert.equal(result.promotionAllowed,false);
 assert.equal(backtestWholeTickets(rows.map(x=>({...x,quotedAt:'2026-11-19T00:00:00Z'}))).status,'insufficient_data');
 assert.equal(backtestWholeTickets([rows[0],rows[0]]).status,'insufficient_data');
 assert.equal(backtestWholeTickets([{...rows[0],independentHoldout:false}]).status,'insufficient_data');
});
