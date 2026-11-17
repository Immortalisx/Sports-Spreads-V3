/* Sports Spreads autocomplete. No network calls from matching; the controller
 * lazily fetches a league's teams once and a selected team's roster once. */
(function(root){
 'use strict';
 const normalize=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
 function match(query,teams=[],players=[],limit=7){
  const q=normalize(query);
  if(q.length<3)return [];
  const indexed=[...teams.map(t=>({type:'team',id:String(t.id),teamId:String(t.id),name:String(t.name),abbr:String(t.abbr||''),teamName:t.name})),
   ...players.map(p=>({type:'player',id:String(p.id),teamId:String(p.teamId),name:String(p.name),abbr:String(p.position||''),teamName:String(p.teamName||'')}))];
  const seen=new Set();
  return indexed.map(x=>({...x,rank:(()=>{let n=normalize(x.name),a=normalize(x.abbr);return n.startsWith(q)?0:n.split(' ').some(w=>w.startsWith(q))?1:a.startsWith(q)?2:n.includes(q)?3:99;})()}))
   .filter(x=>x.rank!==99&&x.id&&x.id!=='undefined'&&!seen.has(x.type+':'+x.teamId+':'+x.id)&&seen.add(x.type+':'+x.teamId+':'+x.id))
   .sort((a,b)=>a.rank-b.rank||a.name.localeCompare(b.name)).slice(0,Math.max(0,Math.min(12,limit)));
 }
 root.SportsAutocomplete=Object.freeze({match,normalize});
})(globalThis);
