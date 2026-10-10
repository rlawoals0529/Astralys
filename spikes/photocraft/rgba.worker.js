// Original isolated PhotoCraft experiment. NOT loaded by the production editor.
// Each instance accepts one in-memory tile job. The caller terminates the worker.
const SIDE=64;
const PLANE=SIDE*SIDE*4;
self.onmessage=async({data})=>{
  try {
    const {wasm,backdrop,source,width,height,mode,opacity}=data;
    const valid=Number.isInteger(width)&&Number.isInteger(height)&&
      width>0&&height>0&&width<=SIDE&&height<=SIDE&&
      (mode===0||mode===1)&&Number.isFinite(opacity)&&opacity>=0&&opacity<=1&&
      Array.isArray(backdrop)&&Array.isArray(source)&&
      backdrop.length===width*height*4&&source.length===width*height*4&&
      backdrop.every(x=>Number.isInteger(x)&&x>=0&&x<=255)&&
      source.every(x=>Number.isInteger(x)&&x>=0&&x<=255);
    if(!valid) throw new Error('Invalid bounded RGBA tile job');
    const {instance}=await WebAssembly.instantiate(new Uint8Array(wasm));
    const api=instance.exports;
    const ptr=api.astralys_tile_ptr();
    if(!Number.isInteger(ptr)||ptr<0||ptr+PLANE*3>api.memory.buffer.byteLength) {
      throw new Error('WASM tile arena out of bounds');
    }
    const arena=new Uint8Array(api.memory.buffer,ptr,PLANE*3);
    arena.fill(0);
    arena.set(backdrop,0);
    arena.set(source,PLANE);
    if(api.astralys_tile_blend(mode,width,height,opacity)!==0) {
      throw new Error('WASM rejected tile');
    }
    self.postMessage({result:Array.from(arena.subarray(PLANE*2,PLANE*2+width*height*4))});
  } catch(error) {
    self.postMessage({error:String(error)});
  }
};
