import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { openApp } from './navigation';
import { inspect } from '../src/core/files';
import { withOrientation } from '../tests/exif-fixtures';

// Independent expected corner order: red, green, blue, yellow in encoded raster.
const orders = [[0,1,2,3],[1,0,3,2],[3,2,1,0],[2,3,0,1],[0,2,1,3],[2,0,3,1],[3,1,2,0],[1,3,0,2]];
const colors = [[240,32,32],[32,208,32],[32,32,240],[240,208,32]];
async function corners(page: Page, bytes: number[]) {
  return page.evaluate(async values => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(values)]));
    const canvas = document.createElement('canvas'); canvas.width=bitmap.width;canvas.height=bitmap.height;
    const ctx=canvas.getContext('2d')!;ctx.drawImage(bitmap,0,0);bitmap.close();
    return [[.25,.25],[.75,.25],[.25,.75],[.75,.75]].map(([x,y])=>Array.from(ctx.getImageData(Math.floor(x*canvas.width),Math.floor(y*canvas.height),1,1).data));
  }, bytes);
}
test.beforeEach(async({page,browserName},testInfo)=>openApp(page,browserName,testInfo));
for (let orientation=1;orientation<=8;orientation++) test(`EXIF ${orientation}: preview and downloaded pixels preserve orientation without metadata`, async({page})=>{
  const original=await page.evaluate(async()=>{
    const c=document.createElement('canvas');c.width=96;c.height=64;const ctx=c.getContext('2d')!;
    for(const [i,color] of ['rgb(240,32,32)','rgb(32,208,32)','rgb(32,32,240)','rgb(240,208,32)'].entries()) {
      ctx.fillStyle=color;ctx.fillRect((i%2)*48,Math.floor(i/2)*32,48,32);
    }
    const b=await new Promise<Blob>(resolve=>c.toBlob(b=>resolve(b!),'image/jpeg',1));
    return Array.from(new Uint8Array(await b.arrayBuffer()));
  });
  const input=withOrientation(Buffer.from(original),orientation,orientation%2===1);
  await page.locator('#file-input').setInputFiles({name:`exif-${orientation}.jpg`,mimeType:'image/jpeg',buffer:input});
  await expect(page.locator('#status')).toContainText('Image ready');
  await expect(page.locator('#width')).toHaveValue(orientation>=5?'64':'96');
  await expect(page.locator('#height')).toHaveValue(orientation>=5?'96':'64');
  const preview=await page.locator('#preview').evaluate(async(node)=>{
    const image=node as HTMLImageElement;
    await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);
    return [[.25,.25],[.75,.25],[.25,.75],[.75,.75]].map(([x,y])=>Array.from(ctx.getImageData(Math.floor(x*canvas.width),Math.floor(y*canvas.height),1,1).data));
  });
  const expected=orders[orientation-1].map(i=>colors[i]);
  const assertPixels=(pixels:number[][])=>pixels.forEach((pixel,i)=>{
    expect(pixel[3]).toBe(255);
    pixel.slice(0,3).forEach((channel,j)=>expect(Math.abs(channel-expected[i][j])).toBeLessThanOrEqual(12));
  });
  assertPixels(preview);
  for(const mime of ['image/png','image/jpeg','image/webp']) {
    await page.locator('#format').selectOption(mime);
    await page.getByRole('button',{name:'Create image',exact:true}).click();
    await expect(page.locator('#download')).toBeVisible();
    const pending=page.waitForEvent('download');await page.locator('#download').click();
    const bytes=await readFile((await (await pending).path())!);
    expect(inspect(bytes)).toMatchObject({mime,width:orientation>=5?64:96,height:orientation>=5?96:64,metadata:[]});
    assertPixels(await corners(page,Array.from(bytes)));
  }
});
