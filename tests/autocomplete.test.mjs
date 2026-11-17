import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';
const code=readFileSync(new URL('../public/autocomplete.js',import.meta.url),'utf8');
const scope={};scope.globalThis=scope;vm.createContext(scope);vm.runInContext(code,scope);const A=scope.SportsAutocomplete;
const teams=[{id:1,name:'New York Knicks',abbr:'NYK'},{id:2,name:'Brooklyn Nets',abbr:'BKN'},{id:3,name:'New York Giants',abbr:'NYG'}];
const players=[{id:7,name:'Jalen Brunson',position:'PG',teamId:1,teamName:'New York Knicks'},{id:9,name:'Jalen Williams',position:'SF',teamId:4,teamName:'Oklahoma City Thunder'}];
test('typeahead requires three letters, matches aliases, and limits suggestions',()=>{
 assert.equal(A.match('Ne',teams,players).length,0);
 assert.equal(A.match('New',teams,players).length,2);
 assert.equal(A.match('kni',teams,players)[0].id,'1');
 assert.equal(A.match('NYK',teams,players)[0].id,'1');
 assert.equal(A.match('jal',teams,players).length,2);
 assert.equal(A.match('jal',teams,players,1).length,1);
});
test('accent handling, punctuation and mixed-case searches are safe',()=>{
 assert.equal(A.normalize('  LéBRON-JAMES!! '),'lebron james');
 assert.equal(A.match('jal',[],players)[0].type,'player');
 assert.deepEqual(Array.from(A.match('notthere',teams,players)),[]);
});
