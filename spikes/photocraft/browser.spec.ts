import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test('pinned PhotoCraft math crosses a browser worker WASM boundary',async({page})=>{
 const bytes=await readFile('spikes/photocraft/target/wasm32-unknown-unknown/release/astralys_photo_spike.wasm');
 // Separate about:blank experiment; no change to production CSP or feature gates.
 const result=await page.evaluate(async data=>{
  const code=`self.onmessage=async e=>{try{const {instance}=await WebAssembly.instantiate(e.data);self.postMessage([instance.exports.astralys_blend(0,.5,.25),instance.exports.astralys_blend(1,.5,.25),Number.isNaN(instance.exports.astralys_blend(3,.5,.5))]);}catch(e){self.postMessage({error:String(e)})}}`;
  const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'})),worker=new Worker(url);
  try{return await new Promise<unknown>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('WASM worker timeout')),5000);worker.onmessage=e=>{clearTimeout(timer);resolve(e.data);};worker.onerror=()=>{clearTimeout(timer);reject(new Error('WASM worker failure'));};worker.postMessage(new Uint8Array(data));});}
  finally{worker.terminate();URL.revokeObjectURL(url);}
 },Array.from(bytes));
 expect(result).toEqual([.125,.625,true]);
});
