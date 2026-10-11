import { checkDimensions } from './files';
import { fitLongestEdge, isLongEdge } from './export-presets';
import type { LongEdge } from './export-presets';
import { frameBounds, validatePhotoState } from './photo';
import type { FrameBounds, PhotoState } from './photo';
import { rasterBudget } from './resource-budget';
import type { RasterBudget } from './resource-budget';

export type RasterJobMode = 'inspect' | 'export' | 'pdf' | 'pdf-page';
export interface RasterPlanRequest {
  mode: RasterJobMode;
  width?: number;
  height?: number;
  fitWithin?: LongEdge;
  photo: PhotoState;
}
export interface RasterPlan {
  orientedW: number;
  orientedH: number;
  frame: FrameBounds;
  width: number;
  height: number;
  toneEnabled: boolean;
  budget: RasterBudget;
}
/**
 * Validate the *inspected* header and admit a job before decoding a full bitmap.
 * The worker must still verify decoded width/height against this header, because
 * the input is untrusted. Estimated buffers do not include browser decoder caches.
 */
export function planRaster(
  sourceWidth: number, sourceHeight: number, job: RasterPlanRequest,
): RasterPlan {
  checkDimensions(sourceWidth,sourceHeight);
  validatePhotoState(job.photo);
  if(!['inspect','export','pdf','pdf-page'].includes(job.mode))throw new Error('Unsupported operation.');
  if(job.fitWithin!==undefined && (
    !isLongEdge(job.fitWithin) || (job.mode!=='export'&&job.mode!=='pdf-page') ||
    job.width!==undefined || job.height!==undefined
  ))throw new Error('Invalid export size preset.');
  const rotated=job.photo.turns%2===1;
  const orientedW=rotated?sourceHeight:sourceWidth;
  const orientedH=rotated?sourceWidth:sourceHeight;
  const frame=frameBounds(orientedW,orientedH,job.photo.frame,job.photo.cropX,job.photo.cropY);
  const naturalW=frame.width,naturalH=frame.height;
  const previewScale=Math.min(1,1200/Math.max(naturalW,naturalH));
  const fit=job.fitWithin===undefined?{width:naturalW,height:naturalH}:fitLongestEdge(naturalW,naturalH,job.fitWithin);
  const width=job.mode==='inspect'?Math.max(1,Math.round(naturalW*previewScale)):(job.width??fit.width);
  const height=job.mode==='inspect'?Math.max(1,Math.round(naturalH*previewScale)):(job.height??fit.height);
  checkDimensions(width,height);
  const toneEnabled=!!(job.photo.brightness||job.photo.contrast||job.photo.saturation);
  if(toneEnabled&&width*height>4_000_000)
    throw new Error('Tonal adjustments are limited to 4 million output pixels. Reduce export dimensions.');
  const budget=rasterBudget(sourceWidth,sourceHeight,width,height,toneEnabled);
  return {orientedW,orientedH,frame,width,height,toneEnabled,budget};
}
