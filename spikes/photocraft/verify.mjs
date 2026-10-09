import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const bytes=await readFile(new URL('./target/wasm32-unknown-unknown/release/astralys_photo_spike.wasm',import.meta.url));
const {instance}=await WebAssembly.instantiate(bytes);
const blend=instance.exports.astralys_blend;
assert.equal(blend(0,.5,.25),.125);assert.equal(blend(1,.5,.25),.625);assert.ok(Number.isNaN(blend(2,.5,.5)));assert.ok(Number.isNaN(blend(0,Infinity,.5)));
console.log(`WASM ABI: 4 assertions passed; ${bytes.length} bytes; imports: ${WebAssembly.Module.imports(await WebAssembly.compile(bytes)).length}`);
