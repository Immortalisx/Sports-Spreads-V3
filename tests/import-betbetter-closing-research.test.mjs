import test from 'node:test';
import assert from 'node:assert/strict';
import {auditBetBetterClosingCSV} from '../engine/import-betbetter-closing-research.mjs';
const head='date_utc,week,home_team,away_team,home_no_vig_close_prob,home_won,home_score,away_score,n_books';
const csv=head+'\n2026-10-11,6,Home,Away,0.57,1,24,20,4\n2026-10-12,6,Another,Visitor,0.41,0,14,21,3\n';
test('attributed offline closing-market fixture yields scores but never whole-ticket ROI',()=>{
 const r=auditBetBetterClosingCSV(csv,{league:'nfl',sourceDOI:'10.17632/5mygfmbjsj.1'});
 assert.equal(r.acceptedGames,2);assert.equal(r.rejectedRows,0);
 assert.equal(r.rows[0].homeWon,true);assert.equal(r.rows[1].homeWon,false);
 assert.equal(r.rows[0].bookmakerOdds,null);assert.equal(r.rows[0].quoteTimestamp,null);
 assert.equal(r.eligibleWholeTickets,0);assert.equal(r.roi,null);assert.equal(r.promotionAllowed,false);
});
test('rejects unlicensed/unattributed sources and inconsistent outcomes',()=>{
 assert.equal(auditBetBetterClosingCSV(csv,{league:'nfl'}).status,'rejected');
 assert.equal(auditBetBetterClosingCSV(csv,{league:'nfl',sourceDOI:'10.17632/5mygfmbjsj.1',sourceLicense:'unknown'}).status,'rejected');
 const r=auditBetBetterClosingCSV(head+'\n2026-10-11,6,Home,Away,0.57,0,24,20,4',{league:'nhl',sourceDOI:'10.17632/5mygfmbjsj.1'});
 assert.equal(r.acceptedGames,0);assert.equal(r.rejectedRows,1);
});
test('handles quoted commas and malformed CSV without producing results',()=>{
 const r=auditBetBetterClosingCSV(head+'\n2026-10-11,6,"Home, City",Away,0.57,1,24,20,4',{league:'nfl',sourceDOI:'10.17632/5mygfmbjsj.1'});
 assert.equal(r.acceptedGames,1);assert.equal(r.rows[0].homeTeam,'Home, City');
 assert.equal(auditBetBetterClosingCSV('"unterminated',{league:'nfl',sourceDOI:'10.17632/5mygfmbjsj.1'}).status,'rejected');
});
