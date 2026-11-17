import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const oneFile=()=>readFileSync(new URL('../release/index.html',import.meta.url),'utf8');
test('polish is lightweight and requires no extra JavaScript/network imports',()=>{
  assert.match(css,/restrained, accessible visual polish/);
  assert.match(css,/radial-gradient/);
  assert.match(css,/\.game:hover/);
  assert.doesNotMatch(css,/animation:\s*infinite/);
});
test('touch, reduced motion, keyboard focus remain supported',()=>{
  assert.match(css,/@media\(hover:none\), \(pointer:coarse\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/\.game button:focus-visible/);
  assert.match(css,/min-height:44px/);
});
test('production HTML still keeps readable previews and accurate model limits',()=>{
  const html=oneFile();
  assert.match(html,/restrained, accessible visual polish/);
  assert.match(html,/Holdout-tested form/);
  assert.match(html,/Recency estimate/);
  assert.match(html,/Preliminary estimate, NOT validated betting confidence/);
  assert.match(html,/sports-spreads\.onrender\.com/);
  assert.match(html,/name="viewport"/);
  assert.doesNotMatch(html,/sb_secret_|service_role/);
});
