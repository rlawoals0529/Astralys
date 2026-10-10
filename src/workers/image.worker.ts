import { checkDimensions, checkSize, inspect, stripEncodedMetadata } from '../core/files';
import type { ImageInfo, ImageMime } from '../core/files';
import { imagePdf } from '../core/pdf';
import { fitLongestEdge, isLongEdge } from '../core/export-presets';
import type { LongEdge } from '../core/export-presets';
import { applyTone, frameBounds, redactionBounds, validatePhotoState } from '../core/photo';
import type { PhotoState } from '../core/photo';
export interface ImageJob { file: File; mode: 'inspect' | 'export' | 'pdf'; mime: ImageMime; width?: number; height?: number; fitWithin?: LongEdge; quality: number; photo: PhotoState; }
export interface ImageResult { blob: Blob; info: ImageInfo; width: number; height: number; }
const stage=(s:string)=>self.postMessage({kind:'progress',stage:s});
self.onmessage=async (event: MessageEvent<ImageJob>)=> {
  let bitmap: ImageBitmap | undefined;
  try {
    const job=event.data;
    if(!['inspect','export','pdf'].includes(job.mode)) throw new Error('Unsupported operation.');
    checkSize(job.file.size);
    if(!['image/png','image/jpeg','image/webp'].includes(job.mime)) throw new Error('Unsupported output format.');
    if(!Number.isFinite(job.quality) || job.quality < 0.1 || job.quality > 1) throw new Error('Quality must be between 10 and 100.');
    validatePhotoState(job.photo);
    if(job.fitWithin!==undefined&&(!isLongEdge(job.fitWithin)||job.mode!=='export'||job.width!==undefined||job.height!==undefined))throw new Error('Invalid export size preset.');
    stage('Checking file structure…');
    const bytes=new Uint8Array(await job.file.arrayBuffer());
    const info=inspect(bytes,job.file.name,job.file.type);
    if(typeof OffscreenCanvas==='undefined' || typeof createImageBitmap==='undefined') throw new Error('This browser lacks worker image support. Try a current Firefox or Chromium browser.');
    stage('Decoding image…');
    bitmap=await createImageBitmap(new Blob([bytes],{type:info.mime}));
    checkDimensions(bitmap.width,bitmap.height);
    const rotated=job.photo.turns%2===1;
    const orientedW=rotated?bitmap.height:bitmap.width, orientedH=rotated?bitmap.width:bitmap.height;
    const frame=frameBounds(orientedW,orientedH,job.photo.frame,job.photo.cropX,job.photo.cropY);
    const naturalW=frame.width, naturalH=frame.height;
    const previewScale=Math.min(1,1200/Math.max(naturalW,naturalH));
    const fit=job.fitWithin===undefined?{width:naturalW,height:naturalH}:fitLongestEdge(naturalW,naturalH,job.fitWithin);
    const width=job.mode==='inspect'?Math.max(1,Math.round(naturalW*previewScale)):(job.width ?? fit.width);
    const height=job.mode==='inspect'?Math.max(1,Math.round(naturalH*previewScale)):(job.height ?? fit.height);
    checkDimensions(width,height);
    const canvas=new OffscreenCanvas(width,height), ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Canvas processing is unavailable in this browser.');
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality='high';
    stage('Drawing pixels…');
    if(job.mode==='pdf' || (job.mime==='image/jpeg' && job.mode==='export')) {ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);}
    ctx.save();ctx.scale(width/frame.width,height/frame.height);ctx.translate(-frame.x,-frame.y);ctx.translate(orientedW/2,orientedH/2);ctx.rotate(job.photo.turns*Math.PI/2);ctx.scale(job.photo.flip?-1:1,1);
    ctx.drawImage(bitmap,-bitmap.width/2,-bitmap.height/2);ctx.restore();
    if(job.photo.brightness||job.photo.contrast||job.photo.saturation) {
      if(width*height>4_000_000)throw new Error('Tonal adjustments are limited to 4 million output pixels. Reduce export dimensions.');
      stage('Adjusting brightness and color…');
      const pixels=ctx.getImageData(0,0,width,height);
      applyTone(pixels.data,job.photo.brightness,job.photo.contrast,job.photo.saturation);
      ctx.putImageData(pixels,0,0);
    }
    if(job.photo.redactions.length) {
      stage('Applying opaque pixel redactions…');
      ctx.fillStyle='#000000';
      ctx.globalCompositeOperation='source-over';
      for(const rect of job.photo.redactions) {
        const bounds=redactionBounds(width,height,rect);
        ctx.fillRect(bounds.x,bounds.y,bounds.width,bounds.height);
      }
    }
    stage('Encoding and removing metadata…');
    const mime=job.mode==='inspect'?'image/png':job.mode==='pdf'?'image/jpeg':job.mime;
    const encoded=await canvas.convertToBlob({type:mime,quality:job.mode==='pdf'?0.92:job.quality});
    if(encoded.type!==mime)throw new Error('Your browser cannot encode this format. Try PNG.');
    if(encoded.size>64*1024*1024)throw new Error('The output is too large. Reduce the dimensions.');
    const clean=stripEncodedMetadata(new Uint8Array(await encoded.arrayBuffer()),mime);
    const blob=job.mode==='pdf'?new Blob([imagePdf(clean,width,height)],{type:'application/pdf'}):new Blob([clean as Uint8Array<ArrayBuffer>],{type:mime});
    self.postMessage({kind:'done',result:{blob,info:{...info,width:bitmap.width,height:bitmap.height},width:job.mode==='inspect'?naturalW:width,height:job.mode==='inspect'?naturalH:height} satisfies ImageResult});
  } catch(error) {self.postMessage({kind:'error',error:error instanceof Error?error.message:'The image could not be processed.'});}
  finally {bitmap?.close();}
};
