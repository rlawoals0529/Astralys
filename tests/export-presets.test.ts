import { expect, test } from 'vitest';
import { fitLongestEdge, isExportPreset, isLongEdge, presetSize } from '../src/core/export-presets';

test('export presets preserve dimensions for small inputs and never upscale',()=>{
 for(const edge of [800,1200,1600,2048] as const){
  expect(fitLongestEdge(8,4,edge)).toEqual({width:8,height:4});
  expect(fitLongestEdge(edge,edge,edge)).toEqual({width:edge,height:edge});
  expect(fitLongestEdge(1,800,edge)).toEqual({width:1,height:800});
 }
 expect(presetSize(8,4,'original')).toEqual({width:8,height:4});
 expect(presetSize(8,4,'long-800')).toEqual({width:8,height:4});
});

test('landscape and portrait presets fit the long edge and keep aspect',()=>{
 expect(presetSize(4000,3000,'long-1600')).toEqual({width:1600,height:1200});
 expect(presetSize(3000,4000,'long-1200')).toEqual({width:900,height:1200});
 expect(presetSize(3840,2160,'long-2048')).toEqual({width:2048,height:1152});
 expect(presetSize(1600,900,'long-800')).toEqual({width:800,height:450});
 expect(presetSize(7,8192,'long-800')).toEqual({width:1,height:800});
});

test('export preset validation rejects unsupported, fractional and unsafe sizes',()=>{
 for(const n of [0,-4,400,4096,Infinity,NaN,'800',800.5])expect(isLongEdge(n)).toBe(false);
 for(const value of ['LONG-800','wide','random','1200',null,Infinity,'custom-800'])expect(isExportPreset(value)).toBe(false);
 expect(isExportPreset('custom')).toBe(true);
 expect(()=>presetSize(640,480,'custom')).toThrow('supported automatic');
 expect(()=>fitLongestEdge(100,100,4096 as 800)).toThrow('Unsupported export');
 expect(()=>fitLongestEdge(0,1,800)).toThrow();
 expect(()=>fitLongestEdge(100,8193,800)).toThrow();
 expect(()=>fitLongestEdge(1.3,300,800)).toThrow();
});
