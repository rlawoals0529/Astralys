import { checkDimensions } from './files';

/**
 * Conservative decoded RGBA memory admission budget for one image operation.
 * This is an estimate of simultaneous pixel buffers, NOT a browser-process RAM limit.
 * Decoder internals, compressed input/output buffers and browser GPU copies are excluded.
 */
export const MAX_RASTER_WORKING_BYTES = 96 * 1024 * 1024;
export interface RasterBudget {
  sourceBytes: number;
  outputBytes: number;
  toneScratchBytes: number;
  estimatedRgbaBytes: number;
  maximumRgbaBytes: number;
}
export function rasterBudget(
  sourceWidth: number, sourceHeight: number,
  outputWidth: number, outputHeight: number,
  toneEnabled: boolean,
): RasterBudget {
  checkDimensions(sourceWidth, sourceHeight);
  checkDimensions(outputWidth, outputHeight);
  const sourceBytes=sourceWidth*sourceHeight*4;
  const outputBytes=outputWidth*outputHeight*4;
  const toneScratchBytes=toneEnabled?outputBytes:0;
  const estimatedRgbaBytes=sourceBytes+outputBytes+toneScratchBytes;
  if(estimatedRgbaBytes>MAX_RASTER_WORKING_BYTES)
    throw new Error('This operation may need too much decoded pixel memory. Use a smaller export size or disable tonal edits.');
  return {sourceBytes,outputBytes,toneScratchBytes,estimatedRgbaBytes,maximumRgbaBytes:MAX_RASTER_WORKING_BYTES};
}
