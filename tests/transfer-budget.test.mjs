import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {brotliCompressSync,constants} from 'node:zlib';
const html=readFileSync(new URL('../index.html',import.meta.url));
const compressed=brotliCompressSync(html,{params:{[constants.BROTLI_PARAM_QUALITY]:5}});
test('one-file initial HTML fits 150 KiB Brotli transfer estimate budget',()=>{
 console.log(`Standalone HTML: ${html.byteLength} raw bytes, ${compressed.byteLength} Brotli quality-5 bytes`);
 assert.ok(compressed.byteLength<=150*1024,`Compressed HTML exceeds 150 KiB: ${compressed.byteLength}`);
});
