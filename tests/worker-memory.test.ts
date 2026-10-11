import { expect, it, vi, afterEach } from 'vitest';
import { png } from './fixtures';
import { blankPhotoState } from '../src/core/photo';
import type { ImageJob, ImageResult } from '../src/workers/image.worker';

afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});

it('decodes via a MIME-correct File slice without materializing a second encoded Blob in app JS',async()=>{
 const payload=png(8,4,false);
 class CountingFile extends File {
   reads=0;slices=0;
   override arrayBuffer(){this.reads++;return super.arrayBuffer();}
   override slice(start?:number,end?:number,contentType?:string){this.slices++;return super.slice(start,end,contentType);}
 }
 const file=new CountingFile([payload],'mislabelled.jpg',{type:'image/jpeg'});
 const bitmap={width:8,height:4,close:vi.fn()};
 const createBitmap=vi.fn(async(blob:Blob)=>{
   expect(blob.size).toBe(payload.byteLength);
   expect(blob.type).toBe('image/png'); // sniffed magic bytes trump declared image/jpeg
   return bitmap;
 });
 const ctx={
  fillStyle:'#ffffff',globalCompositeOperation:'source-over',
  imageSmoothingEnabled:false,imageSmoothingQuality:'low',
  fillRect:vi.fn(),save:vi.fn(),scale:vi.fn(),translate:vi.fn(),rotate:vi.fn(),drawImage:vi.fn(),restore:vi.fn()
 };
 const TestCanvas=class {
  constructor(public width:number,public height:number){}
  getContext(){return ctx;}
  async convertToBlob(){return new Blob([png(8,4,false)],{type:'image/png'});}
 };
 let complete:(value:ImageResult)=>void=()=>{};
 let reject:(error:string)=>void=()=>{};
 const done=new Promise<ImageResult>((resolve,fail)=>{complete=resolve;reject=fail;});
 const workerSelf={
  onmessage:undefined as undefined|((event:MessageEvent<ImageJob>)=>Promise<void>),
  postMessage(message:{kind:string;result?:ImageResult;error?:string}){
   if(message.kind==='done'&&message.result)complete(message.result);
   if(message.kind==='error')reject(message.error||'Unknown worker error');
  }
 };
 vi.stubGlobal('self',workerSelf);
 vi.stubGlobal('createImageBitmap',createBitmap);
 vi.stubGlobal('OffscreenCanvas',TestCanvas);
 await import('../src/workers/image.worker');
 const job:ImageJob={file,mode:'inspect',mime:'image/png',quality:.85,photo:blankPhotoState()};
 expect(workerSelf.onmessage).toBeTypeOf('function');
 const running=workerSelf.onmessage!(new MessageEvent('message',{data:job}));
 const result=await done;await running;
 expect(file.reads).toBe(1);
 expect(file.slices).toBe(1);
 expect(createBitmap).toHaveBeenCalledOnce();
 expect(result.info).toMatchObject({mime:'image/png',width:8,height:4});
 expect(result.info.warning).toContain('does not match');
 expect(bitmap.close).toHaveBeenCalledOnce();
 expect(result.blob.type).toBe('image/png');
});
