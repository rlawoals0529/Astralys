import { expect, test } from 'vitest';
import { blankPhotoState } from '../src/core/photo';
import { planRaster } from '../src/core/image-plan';
import { MAX_RASTER_WORKING_BYTES } from '../src/core/resource-budget';

test('pre-decode plan refuses a full-size 16MP raster before any bitmap is created',()=>{
 const job={mode:'export' as const,photo:blankPhotoState(),quality:.85};
 expect(()=>planRaster(4000,4000,job)).toThrow('too much decoded pixel memory');
 const resized=planRaster(4000,4000,{...job,fitWithin:1200});
 expect(resized.width).toBe(1200);
 expect(resized.height).toBe(1200);
 expect(resized.budget.estimatedRgbaBytes).toBeLessThan(MAX_RASTER_WORKING_BYTES);
});

test('header-based plan preserves exact preview geometry, rotated crop and PDF output',()=>{
 const inspect=planRaster(4000,3000,{mode:'inspect',photo:blankPhotoState()});
 expect(inspect).toMatchObject({orientedW:4000,orientedH:3000,width:1200,height:900,
  frame:{x:0,y:0,width:4000,height:3000},toneEnabled:false});
 const photo={...blankPhotoState(),turns:1,frame:'square' as const,cropX:100,cropY:50};
 const cropped=planRaster(800,400,{mode:'inspect',photo});
 expect(cropped).toMatchObject({orientedW:400,orientedH:800,width:400,height:400,
  frame:{x:0,y:200,width:400,height:400}});
 const pdf=planRaster(640,480,{mode:'pdf',photo:blankPhotoState(),width:320,height:240});
 expect(pdf).toMatchObject({width:320,height:240,toneEnabled:false});
});

test('multi-page PDF preparation also receives admission checks before decoding',()=>{
 const plan=planRaster(4000,3000,{mode:'pdf-page',photo:blankPhotoState(),fitWithin:1200});
 expect(plan).toMatchObject({width:1200,height:900});
 expect(()=>planRaster(4000,4000,{mode:'pdf-page',photo:blankPhotoState()})).toThrow('too much decoded pixel memory');
});

test('tonal scratch admission and malformed requests fail before decode',()=>{
 const photo={...blankPhotoState(),brightness:25};
 const tonal=planRaster(1600,1200,{mode:'export',photo,width:800,height:600});
 expect(tonal.toneEnabled).toBe(true);
 expect(tonal.budget.toneScratchBytes).toBe(800*600*4);
 expect(()=>planRaster(1600,1200,{mode:'export',photo,width:2500,height:2000})).toThrow('4 million');
 expect(()=>planRaster(640,480,{mode:'pdf',photo:blankPhotoState(),fitWithin:800})).toThrow('Invalid export size preset');
 expect(()=>planRaster(640,480,{mode:'export',photo:blankPhotoState(),fitWithin:800,width:500})).toThrow('Invalid export size preset');
 expect(()=>planRaster(640,480,{mode:'export',photo:blankPhotoState(),fitWithin:500 as 800})).toThrow('Invalid export size preset');
 expect(()=>planRaster(8193,1,{mode:'inspect',photo:blankPhotoState()})).toThrow();
});
