import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Guard the production deployment contract while V4 is built on a branch.
// The live Render static site copies the reviewed, generated standalone
// index.html to public/index.html. dist/ is a separate, non-production build.
test('Render blueprint tracks the live Sports Spreads static service',async()=>{
 const config=await readFile(new URL('../render.yaml',import.meta.url),'utf8');
 assert.match(config,/name:\s*sports-spreads\s*$/m);
 assert.match(config,/runtime:\s*static\s*$/m);
 assert.match(config,/buildCommand:\s*mkdir -p public && cp index\.html public\/index\.html\s*$/m);
 assert.match(config,/staticPublishPath:\s*public\s*$/m);
 assert.match(config,/autoDeployTrigger:\s*commit\s*$/m);
 assert.doesNotMatch(config,/staticPublishPath:\s*dist\s*$/m);
});
