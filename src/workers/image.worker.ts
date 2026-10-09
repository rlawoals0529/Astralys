import { checkDimensions, checkSize, inspect, stripEncodedMetadata } from '../core/files';
import type { ImageInfo, ImageMime } from '../core/files';
import type { PhotoState } from '../core/photo';
export interface ImageJob { file: File; mode: 'inspect' | 'export'; mime: ImageMime; width?: number; height?: number; quality: number; photo: PhotoState; }
export interface ImageResult { blob: Blob; info: ImageInfo; width: number; height: number; }
const stage=(s:string)=>self.postMessage({kind:'progress',stage:s});
self.onmessage=async (event: MessageEvent<ImageJob>)=> {
  let bitmap: ImageBitmap | undefined;
  try {
    const job=event.data;
    checkSize(job.file.size);
    if(!['image/png','image/jpeg','image/webp'].includes(job.mime)) throw new Error('Unsupported output format.');
    if(!Number.isFinite(job.quality) || job.quality < 0.1 || job.quality > 1) throw new Error('Quality must be between 10 and 100.');
    if(!Number.isInteger(job.photo.turns) || job.photo.turns<0 || job.photo.turns>3 || typeof job.photo.flip!=='boolean') throw new Error('Invalid photo operation.');
    stage('Checking file structure…');
    const bytes=new Uint8Array(await job.file.arrayBuffer());
    const info=inspect(bytes,job.file.name,job.file.type);
    if(typeof OffscreenCanvas==='undefined' || typeof createImageBitmap==='undefined') throw new Error('This browser lacks worker image support. Try a current Firefox or Chromium browser.');
    stage('Decoding image…');
    bitmap=await createImageBitmap(new Blob([bytes],{type:info.mime}));
    checkDimensions(bitmap.width,bitmap.height);
    const rotated=job.photo.turns%2===1;
    const naturalW=rotated?bitmap.height:bitmap.width, naturalH=rotated?bitmap.width:bitmap.height;
    const previewScale=Math.min(1,1200/Math.max(naturalW,naturalH));
    const width=job.mode==='inspect'?Math.max(1,Math.round(naturalW*previewScale)):(job.width ?? naturalW);
    const height=job.mode==='inspect'?Math.max(1,Math.round(naturalH*previewScale)):(job.height ?? naturalH);
    checkDimensions(width,height);
    const canvas=new OffscreenCanvas(width,height), ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Canvas processing is unavailable in this browser.');
    stage('Drawing pixels…');
    if(job.mime==='image/jpeg' && job.mode==='export') {ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);}
    ctx.save();ctx.translate(width/2,height/2);ctx.scale(width/naturalW,height/naturalH);ctx.rotate(job.photo.turns*Math.PI/2);ctx.scale(job.photo.flip?-1:1,1);
    ctx.drawImage(bitmap,-bitmap.width/2,-bitmap.height/2);ctx.restore();
    stage('Encoding and removing metadata…');
    const mime=job.mode==='inspect'?'image/png':job.mime;
    const encoded=await canvas.convertToBlob({type:mime,quality:job.quality});
    if(encoded.type!==mime)throw new Error('Your browser cannot encode this format. Try PNG.');
    if(encoded.size>64*1024*1024)throw new Error('The output is too large. Reduce the dimensions.');
    const clean=stripEncodedMetadata(new Uint8Array(await encoded.arrayBuffer()),mime);
    self.postMessage({kind:'done',result:{blob:new Blob([clean as Uint8Array<ArrayBuffer>],{type:mime}),info:{...info,width:bitmap.width,height:bitmap.height},width:job.mode==='inspect'?naturalW:width,height:job.mode==='inspect'?naturalH:height} satisfies ImageResult});
  } catch(error) {self.postMessage({kind:'error',error:error instanceof Error?error.message:'The image could not be processed.'});}
  finally {bitmap?.close();}
};
