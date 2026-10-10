import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('pinned PhotoCraft math crosses a browser worker WASM boundary',async({page})=>{
 const bytes=await readFile('spikes/photocraft/target/wasm32-unknown-unknown/release/astralys_photo_spike.wasm');
 // Separate about:blank experiment; no change to production CSP or feature gates.
 const result=await page.evaluate(async data=>{
  const code="self.onmessage=async e=>{try{const {instance}=await WebAssembly.instantiate(e.data);self.postMessage([instance.exports.astralys_blend(0,.5,.25),instance.exports.astralys_blend(1,.5,.25),Number.isNaN(instance.exports.astralys_blend(3,.5,.5))]);}catch(e){self.postMessage({error:String(e)})}}";
  const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'})),worker=new Worker(url);
  try{return await new Promise<unknown>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('WASM worker timeout')),5000);worker.onmessage=e=>{clearTimeout(timer);resolve(e.data);};worker.onerror=()=>{clearTimeout(timer);reject(new Error('WASM worker failure'));};worker.postMessage(new Uint8Array(data));});}
  finally{worker.terminate();URL.revokeObjectURL(url);}
 },Array.from(bytes));
 expect(result).toEqual([.125,.625,true]);
});

test('a dedicated worker blends bounded RGBA tiles with native/WASM parity',async({page})=>{
 const wasm=Array.from(await readFile('spikes/photocraft/target/wasm32-unknown-unknown/release/astralys_photo_spike.wasm'));
 const workerSource=await readFile('spikes/photocraft/rgba.worker.js','utf8');
 const results=await page.evaluate(async({wasm,workerSource})=>{
  const url=URL.createObjectURL(new Blob([workerSource],{type:'text/javascript'}));
  try {
   const run=(mode:number,width:number,height:number,opacity:number,backdrop:number[],source:number[]):Promise<unknown>=>{
    const worker=new Worker(url);
    return new Promise((resolve,reject)=>{
     const timer=setTimeout(()=>{worker.terminate();reject(new Error('RGBA worker timeout'));},5000);
     worker.onmessage=e=>{clearTimeout(timer);worker.terminate();resolve(e.data);};
     worker.onerror=()=>{clearTimeout(timer);worker.terminate();reject(new Error('RGBA worker failure'));};
     worker.postMessage({wasm,mode,width,height,opacity,backdrop,source});
    });
   };
   return [
    await run(0,1,1,.5,[255,0,0,255],[0,0,255,255]),
    await run(1,1,1,.5,[255,0,0,255],[0,0,255,255]),
    await run(0,65,1,.5,[],[]),
    await run(0,1,1,Number.NaN,[255,0,0,255],[0,0,255,255]),
    await run(0,1,1,1,[0,0,0,0],[10,20,30,128])
   ];
  } finally {URL.revokeObjectURL(url);}
 },{wasm,workerSource});
 expect(results).toEqual([
  {result:[128,0,0,255]},
  {result:[255,0,128,255]},
  {error:'Error: Invalid bounded RGBA tile job'},
  {error:'Error: Invalid bounded RGBA tile job'},
  {result:[10,20,30,128]}
 ]);
});
