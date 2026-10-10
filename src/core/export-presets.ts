import { checkDimensions } from './files';

export const EXPORT_PRESETS = ['original','long-2048','long-1600','long-1200','long-800','custom'] as const;
export type ExportPreset=typeof EXPORT_PRESETS[number];
export const isExportPreset=(value:unknown):value is ExportPreset=>
  typeof value==='string'&&(EXPORT_PRESETS as readonly string[]).includes(value);
export const LONG_EDGES=[2048,1600,1200,800] as const;
export type LongEdge=typeof LONG_EDGES[number];
export const isLongEdge=(value:unknown):value is LongEdge=>
  typeof value==='number'&&(LONG_EDGES as readonly number[]).includes(value);
export interface OutputSize {width:number;height:number}
/**
 * Fit *inside* the selected long edge, never enlarge and never crop.
 * A minimum 1-pixel short edge is retained on extreme aspect ratios.
 */
export function fitLongestEdge(width:number,height:number,maxEdge:LongEdge):OutputSize {
  checkDimensions(width,height);
  if(!isLongEdge(maxEdge))throw new Error('Unsupported export size preset.');
  const edge=Math.max(width,height);
  if(edge<=maxEdge)return {width,height};
  const factor=maxEdge/edge;
  const result={width:Math.max(1,Math.round(width*factor)),height:Math.max(1,Math.round(height*factor))};
  checkDimensions(result.width,result.height);
  return result;
}
export function presetSize(width:number,height:number,preset:ExportPreset):OutputSize {
  if(!isExportPreset(preset)||preset==='custom')throw new Error('Choose a supported automatic export preset.');
  checkDimensions(width,height);
  if(preset==='original')return {width,height};
  const edge=Number(preset.slice('long-'.length));
  if(!isLongEdge(edge))throw new Error('Unsupported export size preset.');
  return fitLongestEdge(width,height,edge);
}
