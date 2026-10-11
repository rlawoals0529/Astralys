import { expect, test } from 'vitest';
import { MAX_RASTER_WORKING_BYTES, rasterBudget } from '../src/core/resource-budget';

test('raster working estimate accounts for source, canvas and optional tonal scratch',()=>{
 const neutral=rasterBudget(1600,1000,1200,800,false);
 expect(neutral).toMatchObject({
  sourceBytes:6_400_000,outputBytes:3_840_000,toneScratchBytes:0,
  estimatedRgbaBytes:10_240_000,maximumRgbaBytes:MAX_RASTER_WORKING_BYTES,
 });
 const toned=rasterBudget(1600,1000,1200,800,true);
 expect(toned.toneScratchBytes).toBe(3_840_000);
 expect(toned.estimatedRgbaBytes).toBe(14_080_000);
});

test('large full-size raster operations reject before allocating a destination canvas',()=>{
 expect(()=>rasterBudget(4000,4000,4000,4000,false))
  .toThrow('too much decoded pixel memory');
 expect(()=>rasterBudget(4000,4000,4000,4000,true))
  .toThrow('too much decoded pixel memory');
 expect(rasterBudget(4000,4000,1200,800,true).estimatedRgbaBytes)
  .toBeLessThan(MAX_RASTER_WORKING_BYTES);
});

test('large sources can still be inspected and exported at a smaller size',()=>{
 const preview=rasterBudget(4000,4000,1200,1200,false);
 expect(preview.sourceBytes).toBe(64_000_000);
 expect(preview.estimatedRgbaBytes).toBeLessThan(MAX_RASTER_WORKING_BYTES);
 const nearLimit=rasterBudget(4000,4000,3000,3000,false);
 expect(nearLimit.estimatedRgbaBytes).toBeLessThan(MAX_RASTER_WORKING_BYTES);
 expect(rasterBudget(3840,2160,1920,1080,true).estimatedRgbaBytes)
  .toBeLessThan(MAX_RASTER_WORKING_BYTES);
});

test('admission rejects invalid dimensions independently of the memory budget',()=>{
 for(const args of [
  [0,400,500,500],[-1,1,1,1],[8193,1,1,1],
  [4096,4096,1,1],[10,10,1.5,1],
 ])expect(()=>rasterBudget(args[0],args[1],args[2],args[3],false)).toThrow();
});
