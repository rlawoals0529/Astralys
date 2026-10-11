import { checkDimensions, checkSize, inspect, stripEncodedMetadata } from '../core/files';
import type { ImageInfo, ImageMime } from '../core/files';
import { imagePdf } from '../core/pdf';

import { planRaster } from '../core/image-plan';
import type { LongEdge } from '../core/export-presets';
import { applyTone, redactionBounds } from '../core/photo';
import type { PhotoState } from '../core/photo';
export interface ImageJob { file: File; mode: 'inspect' | 'export' | 'pdf' | 'pdf-page'; mime: ImageMime; width?: number; height?: number; fitWithin?: LongEdge; quality: number; photo: PhotoState; }
export interface ImageResult { blob: Blob; info: ImageInfo; width: number; height: number; }
const stage=(s:string)=>self.postMessage({kind:'progress',stage:s});
/** Release the full source read before asking the decoder for another representation. */
async function inspectSource(file:File):Promise<ImageInfo> {
  const bytes=new Uint8Array(await file.arrayBuffer());
  return inspect(bytes,file.name,file.type);
}
self.onmessage=async (event: MessageEvent<ImageJob>)=> {
  let bitmap: ImageBitmap | undefined;
  try {
    const job=event.data;
    if(!['inspect','export','pdf','pdf-page'].includes(job.mode)) throw new Error('Unsupported operation.');
    checkSize(job.file.size);
    if(!['image/png','image/jpeg','image/webp'].includes(job.mime)) throw new Error('Unsupported output format.');
    if(!Number.isFinite(job.quality) || job.quality < 0.1 || job.quality > 1) throw new Error('Quality must be between 10 and 100.');

    stage('Checking file structure…');
    const info=await inspectSource(job.file);
    // Header-based admission happens *before* decoding a potentially large bitmap.
    // The decoded dimensions are checked against this validated header below.
    stage('Checking decoded pixel memory…');
    const {orientedW,orientedH,frame,width,height,toneEnabled}=planRaster(info.width,info.height,job);
    if(typeof OffscreenCanvas==='undefined' || typeof createImageBitmap==='undefined') throw new Error('This browser lacks worker image support. Try a current Firefox or Chromium browser.');
    stage('Decoding image…');
    // File.slice is a view over the original File. Do not copy the inspection ArrayBuffer
    // into another full encoded Blob; retain the sniffed MIME when the file declares a lie.
    bitmap=await createImageBitmap(job.file.slice(0,job.file.size,info.mime));
    checkDimensions(bitmap.width,bitmap.height);
    if(bitmap.width!==info.width||bitmap.height!==info.height)throw new Error('Decoded image dimensions do not match the file header.');

    const canvas=new OffscreenCanvas(width,height), ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Canvas processing is unavailable in this browser.');
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality='high';
    stage('Drawing pixels…');
    if(job.mode==='pdf' || job.mode==='pdf-page' || (job.mime==='image/jpeg' && job.mode==='export')) {ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);}
    ctx.save();ctx.scale(width/frame.width,height/frame.height);ctx.translate(-frame.x,-frame.y);ctx.translate(orientedW/2,orientedH/2);ctx.rotate(job.photo.turns*Math.PI/2);ctx.scale(job.photo.flip?-1:1,1);
    ctx.drawImage(bitmap,-bitmap.width/2,-bitmap.height/2);ctx.restore();
    // The canvas now owns the source pixels. Free the decoder's original frame before
    // allocating tone scratch or output encoding buffers.
    bitmap.close();bitmap=undefined;
    if(toneEnabled) {
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
    const mime=job.mode==='inspect'?'image/png':(job.mode==='pdf'||job.mode==='pdf-page')?'image/jpeg':job.mime;
    const encoded=await canvas.convertToBlob({type:mime,quality:job.mode==='pdf'?0.92:job.quality});
    if(encoded.type!==mime)throw new Error('Your browser cannot encode this format. Try PNG.');
    if(encoded.size>64*1024*1024)throw new Error('The output is too large. Reduce the dimensions.');
    const clean=stripEncodedMetadata(new Uint8Array(await encoded.arrayBuffer()),mime);
    const blob=job.mode==='pdf'?new Blob([imagePdf(clean,width,height)],{type:'application/pdf'}):new Blob([clean as Uint8Array<ArrayBuffer>],{type:mime});
    self.postMessage({kind:'done',result:{blob,info,width:job.mode==='inspect'?frame.width:width,height:job.mode==='inspect'?frame.height:height} satisfies ImageResult});
  } catch(error) {self.postMessage({kind:'error',error:error instanceof Error?error.message:'The image could not be processed.'});}
  finally {bitmap?.close();}
};
