import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const bytes=await readFile(new URL('./target/wasm32-unknown-unknown/release/astralys_photo_spike.wasm',import.meta.url));
const module=await WebAssembly.compile(bytes);
const instance=await WebAssembly.instantiate(module);
const {astralys_blend:blend,astralys_tile_ptr:tilePtr,astralys_tile_blend:tileBlend,memory}=instance.exports;
assert.equal(blend(0,.5,.25),.125);
assert.equal(blend(1,.5,.25),.625);
assert.ok(Number.isNaN(blend(2,.5,.5)));
assert.ok(Number.isNaN(blend(0,Infinity,.5)));

const PLANE=64*64*4;
assert.ok(memory instanceof WebAssembly.Memory);
const ptr=tilePtr();
assert.ok(Number.isInteger(ptr) && ptr >= 0 && ptr+PLANE*3 <= memory.buffer.byteLength);
const tile=new Uint8Array(memory.buffer,ptr,PLANE*3);
tile.fill(0);
tile.set([255,0,0,255],0);
tile.set([0,0,255,255],PLANE);
assert.equal(tileBlend(0,1,1,.5),0);
assert.deepEqual(Array.from(tile.subarray(PLANE*2,PLANE*2+4)),[128,0,0,255]);
assert.equal(tileBlend(1,1,1,.5),0);
assert.deepEqual(Array.from(tile.subarray(PLANE*2,PLANE*2+4)),[255,0,128,255]);
assert.deepEqual(Array.from(tile.subarray(0,4)),[255,0,0,255]);
assert.deepEqual(Array.from(tile.subarray(PLANE,PLANE+4)),[0,0,255,255]);
for(const [m,w,h,o] of [[2,1,1,.5],[0,65,1,.5],[0,0,1,.5],[0,1,1,NaN],[0,1,1,Infinity]]) {
  assert.equal(tileBlend(m,w,h,o),1);
}
assert.deepEqual(Array.from(tile.subarray(PLANE*2,PLANE*2+4)),[255,0,128,255]);
tile.set([255,0,0,255],PLANE-4);
tile.set([0,0,255,255],PLANE*2-4);
assert.equal(tileBlend(0,64,64,.5),0);
assert.deepEqual(Array.from(tile.subarray(PLANE*3-4,PLANE*3)),[128,0,0,255]);
const linearBeforeRepeatedTiles=memory.buffer.byteLength;
for(let i=0;i<256;i++){
  assert.equal(tileBlend(i%2,64,64,(i%3)/2),0);
}
const linearAfterRepeatedTiles=memory.buffer.byteLength;
assert.equal(linearAfterRepeatedTiles,linearBeforeRepeatedTiles);
assert.ok(linearAfterRepeatedTiles<=4*1024*1024);
console.log(JSON.stringify({wasmBinaryBytes:bytes.byteLength,wasmLinearInitialBytes:linearBeforeRepeatedTiles,wasmLinearFinalBytes:linearAfterRepeatedTiles,repeatedTiles:256,arenaBytes:PLANE*3}));
assert.equal(WebAssembly.Module.imports(module).length,0);
console.log('WASM scalar + RGBA tile assertions passed; '+bytes.length+' bytes; 0 imports');
