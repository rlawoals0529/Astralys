import { test, expect, errors } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { inspect } from '../src/core/files';
import { png, chunk } from '../tests/fixtures';
async function load(page: import('@playwright/test').Page,name='source.png',mime='image/png',bytes=png()) {await page.locator('#file-input').setInputFiles({name,mimeType:mime,buffer:bytes});await expect(page.locator('#workspace')).toBeVisible();await expect(page.locator('#cancel')).toBeHidden();}
test.beforeEach(async({page,browserName},testInfo)=>{
 const failures: string[]=[];let documentOk=false;
 page.on('pageerror',error=>failures.push(error.message));
 page.on('requestfailed',request=>failures.push(request.url()));
 page.on('response',response=>{if(response.status()>=400)failures.push(`${response.status()} ${response.url()}`);if(response.request().isNavigationRequest()&&response.url()==='http://127.0.0.1:4173/')documentOk=response.ok();});
 const navigate=()=>page.goto('/',{waitUntil:'commit',timeout:10_000});
 let response;
 try {response=await navigate();}
 catch(error) {
  // Original, narrowly gated recovery for Playwright Firefox issue #42183.
  // Never retry failed assertions, server errors, missing readiness or broken resources.
  if(browserName!=='firefox'||!(error instanceof errors.TimeoutError))throw error;
  const state=await page.evaluate(()=>({url:location.href,ready:document.readyState,app:document.documentElement.dataset.appReady,
   resourcesComplete:performance.getEntriesByType('resource').every(entry=>(entry as PerformanceResourceTiming).responseEnd>0)}));
  if(!documentOk||failures.length||state.url!=='http://127.0.0.1:4173/'||state.ready!=='complete'||state.app!=='true'||!state.resourcesComplete)throw error;
  testInfo.annotations.push({type:'firefox-navigation-recovery',description:'Loaded app verified; one superseding navigation for Playwright #42183.'});
  await testInfo.attach('firefox-navigation-recovery',{body:JSON.stringify(state),contentType:'application/json'});
  response=await navigate();
 }
 expect(response?.ok()).toBe(true);
 await expect(page.locator('html')).toHaveAttribute('data-app-ready','true');
});
test('original sample opens and the Photo workspace fits desktop and mobile',async({page},testInfo)=>{
 await page.screenshot({path:testInfo.outputPath('home-desktop.png'),fullPage:true});
 await page.locator('#sample').click();await expect(page.locator('#workspace')).toBeVisible();await expect(page.locator('#cancel')).toBeHidden();
 await expect(page.locator('#width')).toHaveValue('960');await expect(page.locator('#height')).toHaveValue('640');
 await page.getByRole('button',{name:'Open in Photo',exact:true}).click();await expect(page.locator('#photo-tools')).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('photo-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('photo-mobile.png'),fullPage:true});
});
test('exports real resized PNG, JPEG and WebP with no metadata and repeatable downloads',async({page})=>{
 await load(page);
 await page.locator('#width').fill('4');await expect(page.locator('#height')).toHaveValue('2');
 for(const mime of ['image/png','image/jpeg','image/webp']) {
  await page.locator('#format').selectOption(mime);await page.getByRole('button',{name:'Create image'}).click();await expect(page.locator('#download')).toBeVisible();
  const pending=page.waitForEvent('download');await page.locator('#download').click();const download=await pending;const bytes=await readFile((await download.path())!);const result=inspect(bytes);
  expect(result.mime).toBe(mime);expect([result.width,result.height]).toEqual([4,2]);expect(result.metadata).toEqual([]);expect(bytes.includes(Buffer.from('PRIVATE'))).toBe(false);
  expect(download.suggestedFilename()).toMatch(/^source-astralys\.(png|jpg|webp)$/);
 }
});
test('MIME mismatch and malicious filename are text, never script',async({page})=>{
 const dialogs:string[]=[];page.on('dialog',d=>{dialogs.push(d.message());void d.dismiss();});
 await load(page,'<img src=x onerror=alert(1)>.html','text/html');
 await expect(page.locator('#file-warning')).toContainText('does not match');await expect(page.locator('#file-name')).toContainText('<img');expect(await page.locator('#file-name img').count()).toBe(0);expect(dialogs).toEqual([]);
 await page.locator('summary').click();await expect(page.locator('#metadata')).toContainText('tEXt');await expect(page.locator('#metadata')).not.toContainText('PRIVATE');
});
test('unsupported, malformed, animated and dimension bomb inputs fail honestly then recover',async({page})=>{
 const large=png();large.writeUInt32BE(9000,16);
 // Keep the dimension-bomb fixture structurally valid so the size guard, not CRC validation, rejects it.
 const ihdr=chunk('IHDR',large.subarray(16,29));large.set(ihdr,8);
 const animated=Buffer.concat([png().subarray(0,33),chunk('acTL',Buffer.alloc(8)),png().subarray(33)]);
 for(const [name,buffer,message] of [['x.svg',Buffer.from('<svg onload="alert(1)"/>'),'not supported'],['broken.png',png().subarray(0,40),'malformed'],['large.png',large,'exceeds'],['animated.png',animated,'Animated PNG'],['x.pdf',Buffer.from('%PDF-1.7'),'PDF detected']] as const) {
  await page.locator('#file-input').setInputFiles({name,mimeType:'image/png',buffer});await expect(page.locator('#status')).toContainText(message);await expect(page.locator('#download')).toBeHidden();
 }
 await load(page);await expect(page.locator('#status')).toContainText('Image ready');
});
test('size boundary is checked before decode',async({page})=>{
 await page.locator('#file-input').setInputFiles({name:'huge.png',mimeType:'image/png',buffer:Buffer.alloc(20*1024*1024+1)});await expect(page.locator('#status')).toContainText('20 MiB');await expect(page.locator('#workspace')).toBeHidden();
});
test('center framing updates preview, exports only selected pixels, and keeps history undoable',async({page})=>{
 const pixels=await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=8;canvas.height=4;
  const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#ff0000';ctx.fillRect(0,0,2,4);
  ctx.fillStyle='#00ff00';ctx.fillRect(2,0,4,4);
  ctx.fillStyle='#0000ff';ctx.fillRect(6,0,2,4);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('fixture failed')),'image/png'));
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
 });
 await load(page,'color-bands.png','image/png',Buffer.from(pixels));
 await page.getByRole('button',{name:'Open in Photo',exact:true}).click();
 const before=await page.locator('#preview').getAttribute('src');
 await page.locator('#frame-select').selectOption('square');
 await page.getByRole('button',{name:'Apply crop'}).click();
 await expect(page.locator('#cancel')).toBeHidden();
 await expect(page.locator('#width')).toHaveValue('4');
 await expect(page.locator('#height')).toHaveValue('4');
 await expect(page.locator('#file-details')).toContainText('8 × 4');
 await expect(page.locator('#preview')).not.toHaveAttribute('src',before!);
 await page.locator('#format').selectOption('image/png');
 await page.getByRole('button',{name:'Create image'}).click();
 await expect(page.locator('#download')).toBeVisible();
 const pending=page.waitForEvent('download');await page.getByRole('link',{name:'Download image'}).click();
 const download=await pending;const bytes=await readFile((await download.path())!);
 expect(inspect(bytes)).toMatchObject({width:4,height:4,metadata:[]});
 const pixel=await page.evaluate(async data=>{
  const bitmap=await createImageBitmap(new Blob([new Uint8Array(data)],{type:'image/png'}));
  const canvas=document.createElement('canvas');canvas.width=4;canvas.height=4;
  const ctx=canvas.getContext('2d')!;ctx.drawImage(bitmap,0,0);bitmap.close();
  return Array.from(ctx.getImageData(0,0,1,1).data);
 },Array.from(bytes));
 expect(pixel).toEqual([0,255,0,255]);
 await page.getByRole('button',{name:'Create PDF',exact:true}).click();
 const pdfLink=page.waitForEvent('download');await page.getByRole('link',{name:'Download PDF'}).click();
 const pdf=await pdfLink;const pdfBytes=await readFile((await pdf.path())!);
 expect(pdfBytes.toString('latin1')).toContain('/MediaBox [0 0 3 3]');
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await expect(page.locator('#frame-select')).toHaveValue('original');
 await expect(page.locator('#width')).toHaveValue('8');
 await expect(page.locator('#height')).toHaveValue('4');
 await page.locator('#frame-select').selectOption('portrait');
 await page.getByRole('button',{name:'Apply crop'}).click();
 await expect(page.locator('#width')).toHaveValue('3');
 await expect(page.locator('#height')).toHaveValue('4');
 await page.getByRole('button',{name:'Rotate 90°'}).click();
 await expect(page.locator('#width')).toHaveValue('4');
 await expect(page.locator('#height')).toHaveValue('5');
 await page.getByRole('button',{name:'Reset original'}).click();
 await expect(page.locator('#frame-select')).toHaveValue('original');
 await expect(page.locator('#width')).toHaveValue('8');
 await expect(page.locator('#height')).toHaveValue('4');
});

test('before/after comparison retains the original preview across edits and PDF export',async({page})=>{
 await load(page);
 await expect(page.locator('#comparison-original')).toBeHidden();
 await page.getByRole('button',{name:'Open in Photo',exact:true}).click();
 const button=page.getByRole('button',{name:'Compare original'});
 await expect(button).toBeEnabled();
 const afterBefore=await page.locator('#preview').getAttribute('src');
 await button.focus();await page.keyboard.press('Enter');
 await expect(page.locator('#compare')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#comparison-original')).toBeVisible();
 await expect(page.locator('#preview-stage')).toHaveAttribute('aria-label','Original and edited image comparison');
 await expect(page.locator('#preview-label')).toHaveText('AFTER · EDITED');
 const originalImage=page.locator('#original-preview');
 const originalSrc=await originalImage.getAttribute('src');
 expect(originalSrc).toMatch(/^blob:/);
 await expect(originalImage).toHaveJSProperty('naturalWidth',8);
 await expect(originalImage).toHaveJSProperty('naturalHeight',4);
 await page.getByRole('button',{name:'Rotate 90°'}).click();
 await expect(page.locator('#width')).toHaveValue('4');
 await expect(page.locator('#height')).toHaveValue('8');
 await expect(page.locator('#cancel')).toBeHidden();
 await expect(originalImage).toHaveAttribute('src',originalSrc!);
 await expect(originalImage).toHaveJSProperty('naturalWidth',8);
 await expect(page.locator('#preview')).not.toHaveAttribute('src',afterBefore!);
 await expect(page.locator('#preview')).toHaveJSProperty('naturalWidth',4);
 await page.locator('#frame-select').selectOption('square');
 await page.getByRole('button',{name:'Apply crop'}).click();
 await expect(page.locator('#width')).toHaveValue('4');
 await expect(page.locator('#height')).toHaveValue('4');
 await expect(originalImage).toHaveAttribute('src',originalSrc!);
 await page.getByRole('button',{name:'Create PDF',exact:true}).click();
 await expect(page.locator('#download')).toBeVisible();
 await expect(originalImage).toHaveAttribute('src',originalSrc!);
 const pending=page.waitForEvent('download');
 await page.getByRole('link',{name:'Download PDF'}).click();
 const download=await pending;
 const pdf=await readFile((await download.path())!);
 expect(pdf.toString('latin1')).toContain('/MediaBox [0 0 3 3]');
 await page.getByRole('button',{name:'Close comparison'}).click();
 await expect(page.locator('#comparison-original')).toBeHidden();
 await expect(page.locator('#compare')).toHaveAttribute('aria-pressed','false');
 await expect(page.locator('#preview-stage')).toHaveAttribute('aria-label','Edited image preview');
 await expect(page.locator('#preview')).toHaveAttribute('src',/^blob:/);
});

test('comparison is local-only, mobile friendly and clears both preview URLs on new files',async({page})=>{
 const remote:string[]=[];
 page.on('request',request=>{if(!request.url().startsWith('http://127.0.0.1:4173/')&&!request.url().startsWith('blob:')) remote.push(request.url());});
 await load(page,'first.png');
 await page.getByRole('button',{name:'Open in Photo',exact:true}).click();
 await page.getByRole('button',{name:'Compare original'}).click();
 const previous=await page.locator('#original-preview').getAttribute('src');
 await page.setViewportSize({width:390,height:844});
 await expect(page.locator('#comparison-original')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await load(page,'second.png');
 await expect(page.locator('#comparison-original')).toBeHidden();
 await expect(page.locator('#compare')).toHaveAttribute('aria-pressed','false');
 await page.getByRole('button',{name:'Open in Photo',exact:true}).click();
 await page.getByRole('button',{name:'Compare original'}).click();
 const second=await page.locator('#original-preview').getAttribute('src');
 expect(second).toMatch(/^blob:/);
 expect(second).not.toBe(previous);
 await page.getByRole('button',{name:'Clear file'}).click();
 await expect(page.locator('#original-preview')).not.toHaveAttribute('src',/blob:/);
 await expect(page.locator('#preview')).not.toHaveAttribute('src',/blob:/);
 await expect(page.locator('#comparison-original')).toBeHidden();
 expect(remote).toEqual([]);
});

test('cancelled edits retain the comparison and original preview',async({page})=>{
 await load(page);await page.getByRole('button',{name:'Open in Photo',exact:true}).click();
 await page.getByRole('button',{name:'Compare original'}).click();
 const before=await page.locator('#original-preview').getAttribute('src');
 const after=await page.locator('#preview').getAttribute('src');
 await page.route('**/assets/image.worker-*.js',route=>route.fulfill({contentType:'text/javascript',body:'self.onmessage=()=>{}'}));
 await page.getByRole('button',{name:'Rotate 90°'}).click();
 await expect(page.locator('#cancel')).toBeVisible();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.locator('#compare')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#comparison-original')).toBeVisible();
 await expect(page.locator('#original-preview')).toHaveAttribute('src',before!);
 await expect(page.locator('#preview')).toHaveAttribute('src',after!);
 await expect(page.locator('#width')).toHaveValue('8');
 await expect(page.locator('#height')).toHaveValue('4');
 await page.unroute('**/assets/image.worker-*.js');
 await page.getByRole('button',{name:'Rotate 90°'}).click();
 await expect(page.locator('#width')).toHaveValue('4');
 await expect(page.locator('#cancel')).toBeHidden();
});
test('crop preview drag and keyboard sliders reposition real exported pixels',async({page})=>{
 const bytes=await page.evaluate(async()=>{
  const c=document.createElement('canvas');c.width=8;c.height=4;const ctx=c.getContext('2d')!;
  for(const [x,w,color] of [[0,2,'#ff0000'],[2,4,'#00ff00'],[6,2,'#0000ff']] as const){
   ctx.fillStyle=color;ctx.fillRect(x,0,w,4);
  }
  const blob=await new Promise<Blob>((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('fixture encoding failed')),'image/png'));
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
 });
 await load(page,'bands.png','image/png',Buffer.from(bytes));
 await page.getByRole('button',{name:'Open in Photo',exact:true}).click();
 await page.locator('#frame-select').selectOption('square');
 await page.getByRole('button',{name:'Apply crop'}).click();
 await expect(page.locator('#crop-position')).toBeVisible();
 await expect(page.locator('#crop-x')).toHaveValue('50');
 await expect(page.locator('#crop-y')).toBeDisabled();
 const img=page.locator('#preview');
 const original=await img.getAttribute('src');
 const box=await img.boundingBox();expect(box).toBeTruthy();
 const x=box!.x+box!.width/2,y=box!.y+box!.height/2;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+box!.width*0.6,y,{steps:4});await page.mouse.up();
 await expect(page.locator('#crop-x')).toHaveValue('0');
 await expect(img).not.toHaveAttribute('src',original!);
 await expect(page.locator('#cancel')).toBeHidden();
 await page.locator('#format').selectOption('image/png');
 await page.getByRole('button',{name:'Create image'}).click();
 const firstDownload=page.waitForEvent('download');await page.getByRole('link',{name:'Download image'}).click();
 const first=await firstDownload;const a=await readFile((await first.path())!);
 expect(inspect(a)).toMatchObject({width:4,height:4,metadata:[]});
 const sample=async(buffer:Buffer)=>{
  return page.evaluate(async pixels=>{
   const bitmap=await createImageBitmap(new Blob([new Uint8Array(pixels)],{type:'image/png'}));
   const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;
   const ctx=c.getContext('2d')!;ctx.drawImage(bitmap,0,0);bitmap.close();
   const first=Array.from(ctx.getImageData(0,0,1,1).data);
   const last=Array.from(ctx.getImageData(c.width-1,0,1,1).data);
   return {first,last};
  },Array.from(buffer));
 };
 expect((await sample(a)).first).toEqual([255,0,0,255]);
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await expect(page.locator('#cancel')).toBeHidden();
 await expect(page.locator('#crop-x')).toHaveValue('50');
 await expect(page.locator('#crop-x')).toBeEnabled();
 await page.locator('#crop-x').focus();
 await page.keyboard.press('End');
 await expect(page.locator('#crop-x')).toHaveValue('100');
 await expect(page.locator('#cancel')).toBeHidden();
 await page.getByRole('button',{name:'Create image'}).click();
 const secondDownload=page.waitForEvent('download');await page.getByRole('link',{name:'Download image'}).click();
 const second=await secondDownload;
 expect((await sample(await readFile((await second.path())!))).last).toEqual([0,0,255,255]);
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('cancelled crop reposition restores original placement and allows recovery',async({page})=>{
 await load(page);await page.getByRole('button',{name:'Open in Photo',exact:true}).click();
 await page.locator('#frame-select').selectOption('square');
 await page.getByRole('button',{name:'Apply crop'}).click();
 await expect(page.locator('#width')).toHaveValue('4');
 await expect(page.locator('#crop-position')).toBeVisible();
 await expect(page.locator('#cancel')).toBeHidden();
 const original=await page.locator('#preview').getAttribute('src');
 await page.route('**/assets/image.worker-*.js',route=>route.fulfill({contentType:'text/javascript',body:'self.onmessage=()=>{}'}));
 await page.locator('#crop-x').evaluate(node=>{
  const slider=node as HTMLInputElement;
  slider.value='0';slider.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await expect(page.locator('#cancel')).toBeVisible();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.locator('#crop-x')).toHaveValue('50');
 await expect(page.locator('#preview')).toHaveAttribute('src',original!);
 await expect(page.locator('#width')).toHaveValue('4');
 await expect(page.locator('#download')).toBeHidden();
 await page.unroute('**/assets/image.worker-*.js');
 await page.locator('#crop-x').focus();await page.keyboard.press('Home');
 await expect(page.locator('#crop-x')).toHaveValue('0');
 await expect(page.locator('#cancel')).toBeHidden();
 await page.getByRole('button',{name:'Reset original'}).click();
 await expect(page.locator('#crop-position')).toBeHidden();
 await expect(page.locator('#width')).toHaveValue('8');
});
test('cancelling crop reverts its preset and preserves the original preview',async({page})=>{
 await load(page);await page.getByRole('button',{name:'Open in Photo',exact:true}).click();
 const before=await page.locator('#preview').getAttribute('src');
 await page.route('**/assets/image.worker-*.js',route=>route.fulfill({contentType:'text/javascript',body:'self.onmessage=()=>{}'}));
 await page.locator('#frame-select').selectOption('square');
 await page.getByRole('button',{name:'Apply crop'}).click();
 await expect(page.locator('#cancel')).toBeVisible();
 await page.locator('#cancel').click();
 await expect(page.locator('#frame-select')).toHaveValue('original');
 await expect(page.locator('#width')).toHaveValue('8');
 await expect(page.locator('#height')).toHaveValue('4');
 await expect(page.locator('#preview')).toHaveAttribute('src',before!);
 await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
 await page.unroute('**/assets/image.worker-*.js');
 await page.locator('#frame-select').selectOption('square');
 await page.getByRole('button',{name:'Apply crop'}).click();
 await expect(page.locator('#cancel')).toBeHidden();
 await expect(page.locator('#width')).toHaveValue('4');
});
test('photo dimensions restore on undo and reset',async({page})=>{
 await load(page);await page.getByRole('button',{name:'Open in Photo',exact:true}).click();await page.getByRole('button',{name:'Rotate 90°'}).click();await expect(page.locator('#width')).toHaveValue('4');await expect(page.locator('#height')).toHaveValue('8');await expect(page.locator('#cancel')).toBeHidden();
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.locator('#width')).toHaveValue('8');await expect(page.locator('#height')).toHaveValue('4');await expect(page.locator('#cancel')).toBeHidden();
 await page.getByRole('button',{name:'Flip horizontal'}).click();await expect(page.locator('#cancel')).toBeHidden();await page.getByRole('button',{name:'Reset original'}).click();await expect(page.locator('#cancel')).toBeHidden();await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
});
test('cancellation terminates stalled worker and a new file recovers',async({page})=>{
 await page.route('**/assets/image.worker-*.js',async route=>{await route.fulfill({contentType:'text/javascript',body:'self.onmessage = () => {}'});});
 await page.locator('#file-input').setInputFiles({name:'source.png',mimeType:'image/png',buffer:png()});await expect(page.locator('#cancel')).toBeVisible();await page.locator('#cancel').click();await expect(page.locator('#status')).toContainText('Cancelled');await expect(page.locator('#download')).toBeHidden();await page.unroute('**/assets/image.worker-*.js');await load(page,'recovered.png');
});
test('clear releases file and generated preview state',async({page})=>{await load(page);await page.getByRole('button',{name:'Create image'}).click();await expect(page.locator('#download')).toBeVisible();await page.getByRole('button',{name:'Clear file'}).click();await expect(page.locator('#workspace')).toBeHidden();await expect(page.locator('#preview')).not.toHaveAttribute('src',/blob:/);await expect(page.locator('#download')).not.toHaveAttribute('href',/blob:/);await expect(page.locator('#choose-file')).toBeFocused();});
test('links are classified without making any remote request',async({page})=>{
 const requests:string[]=[];const favicon=new URL('/mark.svg',page.url()).href;page.on('request',r=>{if(r.url()!==favicon||['fetch','xhr'].includes(r.resourceType()))requests.push(r.url());});await page.getByRole('button',{name:'Paste a link'}).click();await page.locator('#media-url').fill('https://www.youtube.com/watch?v=test');await page.getByRole('button',{name:'Check link'}).click();await expect(page.locator('#link-result')).toContainText('gated');await page.locator('#media-url').fill('https://127.0.0.1/private.mp4');await page.getByRole('button',{name:'Check link'}).click();await expect(page.locator('#link-result')).toContainText('not enabled');expect(requests).toEqual([]);
});
test('keyboard navigation and focus, category honesty, reduced motion and mobile layout',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.keyboard.press('Tab');await expect(page.getByText('Skip to workspace')).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('#main')).toBeFocused();
 await page.getByRole('button',{name:'PDF',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.locator('#category-panel')).toContainText('Existing PDFs are not opened, parsed, merged or modified.');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
});
test('production CSP blocks network and inline script, workers still function',async({page,request})=>{
 const response=await request.get('/');expect(response.headers()['content-security-policy']).toContain("connect-src 'none'");expect(response.headers()['content-security-policy']).not.toContain('unsafe-eval');expect(response.headers()['x-content-type-options']).toBe('nosniff');
 const blocked=await page.evaluate(async()=>{try{await fetch('https://example.com/');return false;}catch{return true;}});expect(blocked).toBe(true);await page.evaluate(()=>{const s=document.createElement('script');s.textContent="document.documentElement.dataset.inlineScriptRan='yes'";document.head.append(s);});await expect(page.locator('html')).not.toHaveAttribute('data-inline-script-ran','yes');await load(page);
});
test('cancelled Photo operation rolls back its pending parameters',async({page})=>{
 await load(page);await page.getByRole('button',{name:'Open in Photo',exact:true}).click();
 await page.route('**/assets/image.worker-*.js',route=>route.fulfill({contentType:'text/javascript',body:'self.onmessage=()=>{}'}));
 await page.getByRole('button',{name:'Rotate 90°'}).click();await page.locator('#cancel').click();await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();await expect(page.locator('#width')).toHaveValue('8');await page.unroute('**/assets/image.worker-*.js');
 await page.getByRole('button',{name:'Rotate 90°'}).click();await expect(page.locator('#width')).toHaveValue('4');await expect(page.locator('#cancel')).toBeHidden();
});
test('drag and drop loads a single real image',async({page})=>{
 const transfer=await page.evaluateHandle(bytes=>{const dt=new DataTransfer();dt.items.add(new File([new Uint8Array(bytes)],'dropped.png',{type:'image/png'}));return dt;},Array.from(png()));
 await page.locator('#dropzone').dispatchEvent('drop',{dataTransfer:transfer});await expect(page.locator('#file-name')).toHaveText('dropped.png');await expect(page.locator('#cancel')).toBeHidden();await transfer.dispose();
});

test('small supporting text meets normal-text contrast',async({page})=>{
 const ratios=await page.locator('.topbar>span:first-child,.eyebrow,.format-note,.entry-footer,.principles article>span,footer,.sidebar-label,.version').evaluateAll(elements=>{
  const rgb=(value:string)=>value.match(/[\d.]+/g)!.map(Number);
  const luminance=(channels:number[])=>channels.slice(0,3).map(v=>{const n=v/255;return n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4;}).reduce((sum,n,i)=>sum+n*[0.2126,0.7152,0.0722][i],0);
  return elements.filter(e=>e.getBoundingClientRect().height>0).map(e=>{
   const foreground=rgb(getComputedStyle(e).color);let node:Element|null=e,background=[255,255,255];
   while(node){const color=rgb(getComputedStyle(node).backgroundColor);if(color.length===3||color[3]===1){background=color;break;}node=node.parentElement;}
   const a=luminance(foreground),b=luminance(background);return {text:e.textContent?.trim().slice(0,40),ratio:(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)};
  });
 });
 expect(ratios.length).toBeGreaterThan(5);for(const result of ratios)expect(result.ratio,result.text).toBeGreaterThanOrEqual(4.5);
});
test('exports a real local single-page PDF while preserving the image preview',async({page})=>{
 await load(page);const preview=await page.locator('#preview').getAttribute('src');
 await page.locator('#width').fill('4');await page.getByRole('button',{name:'Create PDF',exact:true}).click();
 await expect(page.locator('#status')).toContainText('single-page PDF');await expect(page.locator('#result-title')).toHaveText('Your PDF is ready.');
 await expect(page.locator('#preview')).toHaveAttribute('src',preview!);
 const pending=page.waitForEvent('download');await page.getByRole('link',{name:'Download PDF'}).click();const download=await pending;
 expect(download.suggestedFilename()).toBe('source-astralys.pdf');const bytes=await readFile((await download.path())!);const text=bytes.toString('latin1');
 expect(text.startsWith('%PDF-1.4')).toBe(true);expect(text).toContain('/MediaBox [0 0 3 1.5]');expect(text).toContain('/Count 1');expect(text).not.toContain('PRIVATE');
 const jpegStart=text.indexOf('stream\n',text.indexOf('4 0 obj'))+7;const length=Number(text.slice(text.indexOf('4 0 obj'),jpegStart).match(/\/Length (\d+)/)![1]);
 expect(inspect(bytes.subarray(jpegStart,jpegStart+length)).metadata).toEqual([]);
 await page.getByRole('button',{name:'Convert to PDF',exact:true}).click();await expect(page.locator('#cancel')).toBeHidden();await expect(page.locator('#download')).toBeVisible();
});

test('batch conversion isolates malformed inputs and provides manual sanitized downloads',async({page})=>{
 await page.locator('#batch-files').setInputFiles([
  {name:'first.png',mimeType:'image/png',buffer:png()},
  {name:'broken.png',mimeType:'image/png',buffer:Buffer.from('invalid image bytes')},
  {name:'second.png',mimeType:'image/png',buffer:png()}
 ]);
 await expect(page.locator('#batch-start')).toBeEnabled();
 await page.locator('#batch-format').selectOption('image/webp');
 await page.getByRole('button',{name:'Convert selected'}).click();
 await expect(page.locator('#batch-status')).toContainText('2 ready, 1 failed');
 await expect(page.locator('#batch-results li')).toHaveCount(3);
 await expect(page.locator('#batch-results a')).toHaveCount(2);
 await expect(page.locator('#batch-results .batch-error')).toHaveCount(1);
 await expect(page.locator('#batch-results')).toContainText('broken.png');
 await expect(page.locator('#batch-results .batch-error')).toContainText('not supported');
 const pending=page.waitForEvent('download');
 await page.getByRole('link',{name:'Download file 1'}).click();
 const downloaded=await pending;
 expect(downloaded.suggestedFilename()).toBe('first-astralys-1.webp');
 const bytes=await readFile((await downloaded.path())!);
 expect(inspect(bytes)).toMatchObject({mime:'image/webp',width:8,height:4,metadata:[]});
 await page.getByRole('button',{name:'Clear results'}).click();
 await expect(page.locator('#batch-results')).toBeEmpty();
 await expect(page.locator('#batch-start')).toBeDisabled();
});
test('batch selection and cancellation stay bounded; no downloads occur automatically',async({page})=>{
 const tooMany=Array.from({length:9},(_,i)=>({name:'img'+i+'.png',mimeType:'image/png',buffer:png()}));
 await page.locator('#batch-files').setInputFiles(tooMany);
 await expect(page.locator('#batch-status')).toContainText('at most 8');
 await expect(page.locator('#batch-start')).toBeDisabled();
 await page.route('**/assets/image.worker-*.js',route=>route.fulfill({contentType:'text/javascript',body:'self.onmessage=()=>{}'}));
 await page.locator('#batch-files').setInputFiles([{name:'stalled.png',mimeType:'image/png',buffer:png()}]);
 await page.getByRole('button',{name:'Convert selected'}).click();
 await expect(page.getByRole('button',{name:'Cancel batch'})).toBeVisible();
 await page.getByRole('button',{name:'Cancel batch'}).click();
 await expect(page.locator('#batch-status')).toContainText('Batch cancelled');
 await expect(page.locator('#batch-results a')).toHaveCount(0);
 await page.unroute('**/assets/image.worker-*.js');
 await page.getByRole('button',{name:'Convert selected'}).click();
 await expect(page.locator('#batch-status')).toContainText('1 ready, 0 failed');
 await expect(page.locator('#batch-results a')).toHaveCount(1);
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('light and color adjustments change downloaded pixels, preserve alpha and undo',async({page})=>{
 const generated=await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=8;canvas.height=4;
  const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='rgba(80,120,160,0.5)';ctx.fillRect(0,0,8,4);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG failed')),'image/png'));
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
 });
 await load(page,'tone.png','image/png',Buffer.from(generated));
 await page.getByRole('button',{name:'Open in Photo',exact:true}).click();
 await page.getByRole('button',{name:'Compare original'}).click();
 const original=await page.locator('#original-preview').getAttribute('src');
 await page.locator('#tone-brightness').evaluate(node=>{const slider=node as HTMLInputElement;slider.value='20';slider.dispatchEvent(new Event('change',{bubbles:true}));});
 await expect(page.locator('#tone-brightness')).toHaveValue('20');await expect(page.locator('#cancel')).toBeHidden();
 await page.locator('#tone-saturation').evaluate(node=>{const slider=node as HTMLInputElement;slider.value='-100';slider.dispatchEvent(new Event('change',{bubbles:true}));});
 await expect(page.locator('#tone-saturation')).toHaveValue('-100');await expect(page.locator('#cancel')).toBeHidden();
 await expect(page.locator('#original-preview')).toHaveAttribute('src',original!);
 await page.locator('#format').selectOption('image/png');
 await page.getByRole('button',{name:'Create image'}).click();
 const pending=page.waitForEvent('download');await page.getByRole('link',{name:'Download image'}).click();
 const downloaded=await pending;const bytes=await readFile((await downloaded.path())!);
 const pixel=await page.evaluate(async arr=>{
  const bitmap=await createImageBitmap(new Blob([new Uint8Array(arr)],{type:'image/png'}));
  const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
  const ctx=canvas.getContext('2d')!;ctx.drawImage(bitmap,0,0);bitmap.close();
  return Array.from(ctx.getImageData(0,0,1,1).data);
 },Array.from(bytes));
 expect(Math.max(...pixel.slice(0,3))-Math.min(...pixel.slice(0,3))).toBeLessThanOrEqual(1);
 expect(pixel[0]).toBeGreaterThan(120);
 expect(pixel[3]).toBeGreaterThanOrEqual(125);
 expect(pixel[3]).toBeLessThanOrEqual(129);
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await expect(page.locator('#tone-saturation')).toHaveValue('0');
 await expect(page.locator('#tone-brightness')).toHaveValue('20');
 await page.getByRole('button',{name:'Reset light and color'}).click();
 await expect(page.locator('#tone-brightness')).toHaveValue('0');
 await expect(page.locator('#tone-contrast')).toHaveValue('0');
 await expect(page.locator('#cancel')).toBeHidden();
});
test('black redaction destroys selected output pixels across PNG export and is undoable',async({page})=>{
 const source=await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=8;canvas.height=4;
  const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#ff0000';ctx.fillRect(0,0,4,4);ctx.fillStyle='#0000ff';ctx.fillRect(4,0,4,4);
  const b=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(x=>x?resolve(x):reject(new Error('No image')),'image/png'));
  return Array.from(new Uint8Array(await b.arrayBuffer()));
 });
 await load(page,'redact-source.png','image/png',Buffer.from(source));
 await page.getByRole('button',{name:'Open in Photo',exact:true}).click();
 await page.getByRole('button',{name:'Compare original'}).click();
 const initial=await page.locator('#original-preview').getAttribute('src');
 await page.locator('#redact-x').fill('0');await page.locator('#redact-y').fill('0');
 await page.locator('#redact-width').fill('50');await page.locator('#redact-height').fill('100');
 await page.getByRole('button',{name:'Apply black redaction'}).click();
 await expect(page.locator('#redact-count')).toContainText('1 / 10');
 await expect(page.locator('#cancel')).toBeHidden();
 await expect(page.locator('#original-preview')).toHaveAttribute('src',initial!);
 await page.locator('#format').selectOption('image/png');
 await page.getByRole('button',{name:'Create image'}).click();
 const pending=page.waitForEvent('download');await page.getByRole('link',{name:'Download image'}).click();
 const downloaded=await pending;const bytes=await readFile((await downloaded.path())!);
 expect(inspect(bytes)).toMatchObject({width:8,height:4,metadata:[]});
 const colors=await page.evaluate(async arr=>{
  const bmp=await createImageBitmap(new Blob([new Uint8Array(arr)],{type:'image/png'}));
  const canvas=document.createElement('canvas');canvas.width=bmp.width;canvas.height=bmp.height;
  const ctx=canvas.getContext('2d')!;ctx.drawImage(bmp,0,0);bmp.close();
  return [Array.from(ctx.getImageData(1,1,1,1).data),Array.from(ctx.getImageData(7,1,1,1).data)];
 },Array.from(bytes));
 expect(colors[0]).toEqual([0,0,0,255]);
 expect(colors[1]).toEqual([0,0,255,255]);
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await expect(page.locator('#redact-count')).toContainText('0 / 10');
 await expect(page.locator('#cancel')).toBeHidden();
 await page.getByRole('button',{name:'Select redaction on preview'}).click();
 await expect(page.locator('#redact-draw')).toHaveAttribute('aria-pressed','true');
 const image=page.locator('#preview'),box=await image.boundingBox();expect(box).toBeTruthy();
 expect(box!.width).toBeGreaterThanOrEqual(100);
 expect(box!.y).toBeGreaterThanOrEqual(0);
 expect(box!.y+box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
 await page.mouse.move(box!.x+box!.width*0.15,box!.y+box!.height*0.2);
 await page.mouse.down();
 await page.mouse.move(box!.x+box!.width*0.5,box!.y+box!.height*0.8,{steps:6});
 await page.mouse.up();
 await expect(page.locator('#redact-count')).toContainText('1 / 10');
 await expect(page.locator('#redact-draw')).toHaveAttribute('aria-pressed','false');
});
test('cancelling a tonal edit restores its original parameter and pixels',async({page})=>{
 await load(page);await page.getByRole('button',{name:'Open in Photo',exact:true}).click();
 const src=await page.locator('#preview').getAttribute('src');
 await page.route('**/assets/image.worker-*.js',route=>route.fulfill({contentType:'text/javascript',body:'self.onmessage=()=>{}'}));
 await page.locator('#tone-contrast').evaluate(node=>{const slider=node as HTMLInputElement;slider.value='80';slider.dispatchEvent(new Event('change',{bubbles:true}));});
 await expect(page.locator('#cancel')).toBeVisible();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.locator('#tone-contrast')).toHaveValue('0');
 await expect(page.locator('#preview')).toHaveAttribute('src',src!);
 await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
 await page.unroute('**/assets/image.worker-*.js');
});

test('single export presets avoid upscaling, preserve aspect and follow rotated crop',async({page})=>{
 await load(page,'big.png','image/png',png(1200,800,false));
 await expect(page.locator('#size-preset')).toHaveValue('original');
 await page.locator('#size-preset').selectOption('long-800');
 await expect(page.locator('#width')).toHaveValue('800');
 await expect(page.locator('#height')).toHaveValue('533');
 await expect(page.locator('#size-preset-help')).toContainText('without cropping or upscaling');
 await page.locator('#width').fill('400');
 await expect(page.locator('#size-preset')).toHaveValue('custom');
 await expect(page.locator('#height')).toHaveValue('267');
 await page.getByRole('button',{name:'Open in Photo',exact:true}).click();
 await page.locator('#size-preset').selectOption('long-800');
 await page.getByRole('button',{name:'Rotate 90°'}).click();
 await expect(page.locator('#cancel')).toBeHidden();
 await expect(page.locator('#size-preset')).toHaveValue('long-800');
 await expect(page.locator('#width')).toHaveValue('533');
 await expect(page.locator('#height')).toHaveValue('800');
 await page.locator('#frame-select').selectOption('square');
 await page.getByRole('button',{name:'Apply crop'}).click();
 await expect(page.locator('#cancel')).toBeHidden();
 await expect(page.locator('#width')).toHaveValue('800');
 await expect(page.locator('#height')).toHaveValue('800');
 await page.locator('#size-preset').selectOption('long-1200');
 await expect(page.locator('#width')).toHaveValue('800');
 await expect(page.locator('#size-preset-help')).toContainText('No upscaling');
 await page.locator('#format').selectOption('image/png');
 await page.getByRole('button',{name:'Create image'}).click();
 const waiting=page.waitForEvent('download');
 await page.getByRole('link',{name:'Download image'}).click();
 const download=await waiting;
 const bytes=await readFile((await download.path())!);
 expect(inspect(bytes)).toMatchObject({mime:'image/png',width:800,height:800,metadata:[]});
});

test('batch size presets cap the long edge without enlarging tiny files',async({page})=>{
 await page.locator('#batch-files').setInputFiles([
  {name:'landscape.png',mimeType:'image/png',buffer:png(1600,900,false)},
  {name:'tiny.png',mimeType:'image/png',buffer:png(16,9,false)}
 ]);
 await page.locator('#batch-format').selectOption('image/webp');
 await page.locator('#batch-size').selectOption('long-800');
 await page.getByRole('button',{name:'Convert selected'}).click();
 await expect(page.locator('#batch-status')).toContainText('2 ready, 0 failed');
 await expect(page.locator('#batch-results')).toContainText('800 × 450');
 await expect(page.locator('#batch-results')).toContainText('16 × 9');
 for(const [label,w,h] of [['Download file 1',800,450],['Download file 2',16,9]] as const){
  const waiting=page.waitForEvent('download');
  await page.getByRole('link',{name:label}).click();
  const download=await waiting;
  expect(inspect(await readFile((await download.path())!))).toMatchObject({mime:'image/webp',width:w,height:h,metadata:[]});
 }
});

test('photo-like gradient with alpha survives local PNG/JPEG re-encoding and records export evidence',async({page},testInfo)=>{
 const array=await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=400;
  const ctx=canvas.getContext('2d')!;
  const grad=ctx.createLinearGradient(0,0,640,400);
  grad.addColorStop(0,'#122d52');grad.addColorStop(0.5,'#c69e74');grad.addColorStop(1,'#ffb877');
  ctx.fillStyle=grad;ctx.fillRect(0,0,640,400);
  ctx.fillStyle='#427534';
  for(let i=0;i<35;i++){ctx.beginPath();ctx.arc((i*47)%640,(i*79)%400,5+(i%3)*4,0,Math.PI*2);ctx.fill();}
  ctx.clearRect(0,0,72,72);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Fixture encode failed')),'image/png'));
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
 });
 const bytes=Buffer.from(array);
 await load(page,'landscape.png','image/png',bytes);
 await page.locator('#size-preset').selectOption('long-800');
 await expect(page.locator('#width')).toHaveValue('640');
 await page.locator('#format').selectOption('image/png');
 await page.getByRole('button',{name:'Create image'}).click();
 let pending=page.waitForEvent('download');
 await page.getByRole('link',{name:'Download image'}).click();
 const pngOut=await readFile((await (await pending).path())!);
 expect(inspect(pngOut)).toMatchObject({mime:'image/png',width:640,height:400,metadata:[]});
 const start=Date.now();
 await page.locator('#width').fill('320');
 await expect(page.locator('#size-preset')).toHaveValue('custom');
 await page.locator('#format').selectOption('image/jpeg');
 await page.locator('#quality').evaluate(node=>{const range=node as HTMLInputElement;range.value='90';range.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.getByRole('button',{name:'Create image'}).click();
 pending=page.waitForEvent('download');
 await page.getByRole('link',{name:'Download image'}).click();
 const jpegOut=await readFile((await (await pending).path())!);
 expect(inspect(jpegOut)).toMatchObject({mime:'image/jpeg',width:320,height:200,metadata:[]});
 const samples=await page.evaluate(async(raw)=>{
  const b=await createImageBitmap(new Blob([new Uint8Array(raw)],{type:'image/jpeg'}));
  const can=document.createElement('canvas');can.width=b.width;can.height=b.height;
  const ctx=can.getContext('2d')!;ctx.drawImage(b,0,0);b.close();
  return {corner:Array.from(ctx.getImageData(5,5,1,1).data),scene:Array.from(ctx.getImageData(200,120,1,1).data)};
 },Array.from(jpegOut));
 expect(samples.corner.slice(0,3).every(v=>v>245)).toBe(true);
 expect(Math.max(...samples.scene.slice(0,3))-Math.min(...samples.scene.slice(0,3))).toBeGreaterThan(10);
 const evidence={fixture:'deterministic synthetic landscape-like gradient with opaque detail and transparent corner',
  sourceBytes:bytes.length,pngBytes:pngOut.length,jpegBytes:jpegOut.length,
  outputDimensions:'320x200',sampledCorner:samples.corner,sampledScene:samples.scene,
  downloadAndProcessingElapsedMs:Date.now()-start,notes:'Synthetic fidelity evidence, NOT real-photograph ICC or browser RSS measurement'};
 await testInfo.attach('image-fidelity-evidence.json',{body:JSON.stringify(evidence,null,2),contentType:'application/json'});
 await expect(page.locator('#size-preset-help')).toContainText('Custom dimensions');
});

test('static Cloudflare-ready build keeps CSP, no raw deployment metadata and no fake route fallback',async({page,request})=>{
 const response=await request.get('/');
 expect(response.ok()).toBe(true);
 const headers=response.headers();
 expect(headers['content-security-policy']).toContain("connect-src 'none'");
 expect(headers['content-security-policy']).toContain("worker-src 'self'");
 expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
 expect(headers['x-content-type-options']).toBe('nosniff');
 for(const path of ['/_headers','/.env','/arbitrary/unknown-route','/assets/missing-file.js']){
  const missing=await request.get(path);
  expect(missing.status(),path).toBe(404);
 }
 await load(page);
 await page.getByRole('button',{name:'Open in Photo',exact:true}).click();
 await page.getByRole('button',{name:'Compare original'}).focus();
 await page.keyboard.press('Enter');
 await expect(page.locator('#comparison-original')).toBeVisible();
 const image=page.locator('#preview');
 await expect(image).toHaveAttribute('src',/^blob:/);
 expect(await page.evaluate(()=>performance.getEntriesByType('resource').some(e=>e.name.startsWith('https://')))).toBe(false);
});

test('mobile preset controls and redaction inputs remain keyboard accessible',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await load(page);
 const preset=page.getByLabel('Export size');
 await preset.focus();
 await page.keyboard.press('End');
 await expect(page.locator('#size-preset')).toHaveValue('custom');
 await page.keyboard.press('Home');
 await expect(page.locator('#size-preset')).toHaveValue('original');
 await page.getByRole('button',{name:'Open in Photo',exact:true}).click();
 await page.getByLabel('Left %').focus();
 await page.keyboard.press('ControlOrMeta+A');
 await page.keyboard.type('20');
 await expect(page.locator('#redact-x')).toHaveValue('20');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('all disposable image workers terminate and all Blob URLs are revoked after explicit clear',async({page},testInfo)=>{
 await page.evaluate(()=>{
   const nativeWorker=window.Worker;
   const realCreate=URL.createObjectURL.bind(URL),realRevoke=URL.revokeObjectURL.bind(URL);
   const tracked={active:0,maxConcurrent:0,workersStarted:0,created:0,revoked:0,live:new Set<string>()};
   class ObservedWorker extends nativeWorker {
     private released=false;
     constructor(url:string|URL,options?:WorkerOptions) {
       super(url,options);
       tracked.active++;tracked.workersStarted++;
       tracked.maxConcurrent=Math.max(tracked.maxConcurrent,tracked.active);
     }
     override terminate(){
       if(!this.released){this.released=true;tracked.active--;}
       super.terminate();
     }
   }
   window.Worker=ObservedWorker;
   URL.createObjectURL=(blob:Blob|MediaSource)=>{
     const url=realCreate(blob);tracked.created++;tracked.live.add(url);return url;
   };
   URL.revokeObjectURL=(url:string)=>{
     tracked.revoked++;tracked.live.delete(url);realRevoke(url);
   };
   Object.assign(window,{__qaResourceTracker:tracked});
 });
 const snapshot=()=>page.evaluate(()=>{
   const t=(window as typeof window & {__qaResourceTracker:{active:number;maxConcurrent:number;workersStarted:number;created:number;revoked:number;live:Set<string>}}).__qaResourceTracker;
   return {active:t.active,maxConcurrent:t.maxConcurrent,workersStarted:t.workersStarted,created:t.created,revoked:t.revoked,live:t.live.size};
 });
 const initial=await snapshot();expect(initial.active).toBe(0);expect(initial.live).toBe(0);
 const began=Date.now();
 await load(page,'photo.png','image/png',png(400,300,false));
 await page.getByRole('button',{name:'Open in Photo',exact:true}).click();
 await page.getByRole('button',{name:'Rotate 90°'}).click();
 await expect(page.locator('#cancel')).toBeHidden();
 await page.getByRole('button',{name:'Create image'}).click();
 await expect(page.locator('#download')).toBeVisible();
 const edited=await snapshot();
 expect(edited.active).toBe(0);expect(edited.live).toBe(3);
 await page.getByRole('button',{name:'Clear file'}).click();
 const cleared=await snapshot();
 expect(cleared.active).toBe(0);expect(cleared.live).toBe(0);
 await page.locator('#batch-files').setInputFiles([
   {name:'one.png',mimeType:'image/png',buffer:png(400,300,false)},
   {name:'two.png',mimeType:'image/png',buffer:png(320,240,false)}
 ]);
 await page.getByRole('button',{name:'Convert selected'}).click();
 await expect(page.locator('#batch-status')).toContainText('2 ready, 0 failed');
 const batch=await snapshot();
 expect(batch.active).toBe(0);expect(batch.live).toBe(2);
 await page.getByRole('button',{name:'Clear results'}).click();
 const final=await snapshot();
 expect(final.active).toBe(0);expect(final.live).toBe(0);
 expect(final.maxConcurrent).toBe(1);
 expect(final.workersStarted).toBeGreaterThanOrEqual(5);
 expect(final.created).toBe(final.revoked);
 await testInfo.attach('local-resource-lifecycle.json',{body:JSON.stringify({
   fixture:'Synthetic 400x300 and 320x240 PNGs; no real user media',
   initial,edited,cleared,batch,final,elapsedMs:Date.now()-began,
   caveat:'Counts observable Worker instances and Object URLs in this page, not renderer/native process RSS or garbage collection'
 },null,2),contentType:'application/json'});
});

test('privacy details and keyboard-alternative redaction remain labelled and mobile accessible',async({page})=>{
 const control=page.locator('#privacy-button');
 await expect(control).toHaveAttribute('aria-controls','privacy-panel');
 await expect(control).toHaveAttribute('aria-expanded','false');
 await control.focus();await page.keyboard.press('Enter');
 await expect(control).toHaveAttribute('aria-expanded','true');
 await expect(page.locator('#privacy-panel')).toBeVisible();
 await page.getByRole('button',{name:'Close privacy details'}).click();
 await expect(control).toHaveAttribute('aria-expanded','false');
 await expect(page.locator('#privacy-panel')).toBeHidden();
 await expect(control).toBeFocused();
 await load(page);
 await page.getByRole('button',{name:'Open in Photo',exact:true}).click();
 const x=page.locator('#redact-x');
 await expect(x).toHaveAttribute('aria-describedby','redact-help');
 await x.fill('0');await page.locator('#redact-y').fill('0');
 await page.locator('#redact-width').fill('50');await page.locator('#redact-height').fill('50');
 await page.locator('#redact-apply').focus();await page.keyboard.press('Enter');
 await expect(page.locator('#redact-count')).toContainText('1 / 10');
 await expect(page.locator('#cancel')).toBeHidden();
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await expect(page.locator('#redact-count')).toContainText('0 / 10');
 await expect(page.locator('#cancel')).toBeHidden();
 for(const width of [320,390,768,1280,1920]){
   await page.setViewportSize({width,height:850});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`horizontal overflow at ${width}px`).toBe(true);
 }
 await page.locator('#size-preset').focus();
 await expect(page.locator('#size-preset')).toHaveAttribute('aria-describedby','size-preset-help');
 await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');
 await expect(page.locator('#size-preset')).toHaveValue('long-2048');
 await expect(page.locator('#size-preset-help')).toContainText('No upscaling');
 expect(await page.evaluate(()=>document.activeElement?.id)).toBe('size-preset');
});

test('scoped decode survives mismatched declared MIME and preserves local-only downloaded pixels',async({page},testInfo)=>{
 const outgoing:string[]=[];
 page.on('request',request=>{
  const url=request.url();
  if(!url.startsWith('http://127.0.0.1:4173/')&&!url.startsWith('blob:'))
    outgoing.push(url);
 });
 // File.type is untrusted: the byte-signature inspection must still drive the decode.
 await load(page,'wrong-extension.jpg','image/jpeg',png(1200,800,true));
 await expect(page.locator('#file-warning')).toContainText('does not match');
 await expect(page.locator('#width')).toHaveValue('1200');
 await page.locator('#size-preset').selectOption('long-800');
 await expect(page.locator('#width')).toHaveValue('800');
 await expect(page.locator('#height')).toHaveValue('533');
 await page.getByRole('button',{name:'Open in Photo',exact:true}).click();
 await page.locator('#tone-brightness').evaluate(node=>{
  const slider=node as HTMLInputElement;slider.value='12';slider.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await expect(page.locator('#cancel')).toBeHidden();
 await page.locator('#format').selectOption('image/png');
 await page.getByRole('button',{name:'Create image'}).click();
 const pending=page.waitForEvent('download');
 await page.getByRole('link',{name:'Download image'}).click();
 const download=await pending;
 const result=inspect(await readFile((await download.path())!));
 expect(result).toMatchObject({mime:'image/png',width:800,height:533,metadata:[]});
 expect(outgoing).toEqual([]);
 const perf=await page.evaluate(()=>{
  // Some Chromium builds expose performance.memory; Firefox normally does not.
  const memory=(performance as Performance&{memory?:{usedJSHeapSize?:number}}).memory;
  return {reportedJsHeapBytes:memory?.usedJSHeapSize??null,
   note:'JS heap only; not browser process RSS, decoder, GPU or wasm memory'};
 });
 await testInfo.attach('local-memory-evidence.json',{body:JSON.stringify(perf),contentType:'application/json'});
 await page.getByRole('button',{name:'Clear file'}).click();
 await expect(page.locator('#preview')).not.toHaveAttribute('src',/blob:/);
 await expect(page.locator('#download')).not.toHaveAttribute('href',/blob:/);
});

test('local multi-page image PDF uses sanitized JPEG streams and correct page/xref structure',async({page})=>{
 await page.locator('#pdf-page-files').setInputFiles([
   {name:'one.png',mimeType:'image/png',buffer:png(8,4,true)},
   {name:'two.png',mimeType:'image/png',buffer:png(6,3,true)}
 ]);
 await expect(page.locator('#pdf-compose')).toBeEnabled();
 await page.getByRole('button',{name:'Create multi-page PDF'}).click();
 await expect(page.locator('#pdf-status')).toContainText('2 image pages');
 await expect(page.locator('#pdf-result')).toBeVisible();
 const pending=page.waitForEvent('download');
 await page.getByRole('link',{name:'Download multi-page PDF'}).click();
 const d=await pending;expect(d.suggestedFilename()).toBe('astralys-pages.pdf');
 const bytes=await readFile((await d.path())!);const text=bytes.toString('latin1');
 expect(text.startsWith('%PDF-1.4')).toBe(true);
 expect(text).toContain('/Kids [3 0 R 6 0 R]');
 expect(text).toContain('/Count 2');
 expect(text).toContain('/MediaBox [0 0 6 3]');
 expect(text).toContain('/MediaBox [0 0 4.5 2.25]');
 expect(text.match(/\/Subtype \/Image/g)).toHaveLength(2);
 expect(text).not.toMatch(/PRIVATE|\/JavaScript|\/EmbeddedFiles/);
 const start=Number(text.match(/startxref\n(\d+)\n%%EOF/)![1]);
 const rows=text.slice(start).split('\n');expect(rows[1]).toBe('0 9');
 for(let id=1;id<=8;id++){
   const offset=Number(rows[id+2].slice(0,10));
   expect(text.slice(offset,offset+7)).toBe(`${id} 0 obj`);
 }
 for(const id of [4,7]){
   const header=text.slice(text.indexOf(`${id} 0 obj`),text.indexOf('stream\n',text.indexOf(`${id} 0 obj`)));
   const length=Number(header.match(/\/Length (\d+)/)![1]);
   const offset=text.indexOf('stream\n',text.indexOf(`${id} 0 obj`))+7;
   const jpeg=bytes.subarray(offset,offset+length);
   expect(inspect(jpeg)).toMatchObject({mime:'image/jpeg',metadata:[]});
 }
 await page.getByRole('button',{name:'Clear PDF'}).click();
 await expect(page.locator('#pdf-result')).toBeHidden();
 await expect(page.locator('#pdf-download')).not.toHaveAttribute('href',/blob:/);
});
test('multi-page composer rejects malformed images as a whole and can recover',async({page})=>{
 await page.locator('#pdf-page-files').setInputFiles([
   {name:'valid.png',mimeType:'image/png',buffer:png(8,4,false)},
   {name:'bad.png',mimeType:'image/png',buffer:Buffer.from('not a valid image')}
 ]);
 await page.getByRole('button',{name:'Create multi-page PDF'}).click();
 await expect(page.locator('#pdf-status')).toContainText('not supported');
 await expect(page.locator('#pdf-result')).toBeHidden();
 await expect(page.locator('#pdf-cancel')).toBeHidden();
 await page.locator('#pdf-page-files').setInputFiles([
   {name:'valid.png',mimeType:'image/png',buffer:png(8,4,false)},
   {name:'valid2.png',mimeType:'image/png',buffer:png(8,4,false)}
 ]);
 await page.getByRole('button',{name:'Create multi-page PDF'}).click();
 await expect(page.locator('#pdf-result')).toBeVisible();
 await page.setViewportSize({width:320,height:850});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('multi-page composition cancellation terminates a stalled worker and releases the result',async({page})=>{
 await page.locator('#pdf-page-files').setInputFiles([
   {name:'one.png',mimeType:'image/png',buffer:png()},
   {name:'two.png',mimeType:'image/png',buffer:png()}
 ]);
 await page.route('**/assets/image.worker-*.js',route=>route.fulfill({contentType:'text/javascript',body:'self.onmessage=()=>{}'}));
 await page.getByRole('button',{name:'Create multi-page PDF'}).click();
 await expect(page.getByRole('button',{name:'Cancel PDF'})).toBeVisible();
 await page.getByRole('button',{name:'Cancel PDF'}).click();
 await expect(page.locator('#pdf-status')).toContainText('cancelled');
 await expect(page.locator('#pdf-result')).toBeHidden();
 await page.unroute('**/assets/image.worker-*.js');
 await page.getByRole('button',{name:'Create multi-page PDF'}).click();
 await expect(page.locator('#pdf-result')).toBeVisible();
 await expect(page.locator('#pdf-status')).toContainText('2 image pages');
});
test('16MP original export is rejected by raster admission and a smaller preset safely recovers',async({page})=>{
 const large=png(4000,4000,false);
 await load(page,'high-resolution.png','image/png',large);
 await expect(page.locator('#width')).toHaveValue('4000');
 await expect(page.locator('#height')).toHaveValue('4000');
 await expect(page.locator('#size-preset')).toHaveValue('original');
 await page.getByRole('button',{name:'Create image'}).click();
 await expect(page.locator('#status')).toContainText('too much decoded pixel memory');
 await expect(page.locator('#cancel')).toBeHidden();
 await expect(page.locator('#result')).toBeHidden();
 await page.locator('#size-preset').selectOption('long-800');
 await expect(page.locator('#width')).toHaveValue('800');
 await expect(page.locator('#height')).toHaveValue('800');
 await page.locator('#format').selectOption('image/png');
 await page.getByRole('button',{name:'Create image'}).click();
 await expect(page.locator('#download')).toBeVisible();
 const waiting=page.waitForEvent('download');
 await page.getByRole('link',{name:'Download image'}).click();
 const out=await readFile((await (await waiting).path())!);
 expect(inspect(out)).toMatchObject({mime:'image/png',width:800,height:800,metadata:[]});
 await page.getByRole('button',{name:'Clear file'}).click();
 await expect(page.locator('#workspace')).toBeHidden();
});

// Simulate browser zoom by reducing the CSS viewport while retaining a desktop-sized
// device scale factor. This checks responsive layout, not assistive-technology behavior.
test('Photo export remains usable at narrow CSS viewports',async({page})=>{
 await page.setViewportSize({width:320,height:720});
 await page.locator('#sample').click();
 await expect(page.locator('#workspace')).toBeVisible();
 await expect(page.locator('#export-form')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const exportForm=page.locator('#export-form');
 const bounds=await exportForm.boundingBox();
 expect(bounds).not.toBeNull();
 expect(bounds!.x).toBeGreaterThanOrEqual(0);
 expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(321);
 await page.getByRole('button',{name:'Create image'}).click();
 await expect(page.locator('#download')).toBeVisible();
});

test('sequential exports replace stale download URLs and clear revokes the final URL',async({page})=>{
 await load(page);
 const urls:string[]=[];
 for(const mime of ['image/png','image/jpeg','image/webp','image/png']) {
  await page.locator('#format').selectOption(mime);
  await page.getByRole('button',{name:'Create image'}).click();
  const download=page.locator('#download');
  await expect(download).toBeVisible();
  const url=await download.getAttribute('href');
  expect(url).toMatch(/^blob:/);
  expect(urls).not.toContain(url);
  urls.push(url!);
  if(urls.length>1) {
   const previous=urls[urls.length-2];
   await expect.poll(()=>page.evaluate(async u=>{
    try {const response=await fetch(u);return response.ok;}catch{return false;}
   },previous)).toBe(false);
  }
 }
 await page.getByRole('button',{name:'Clear file'}).click();
 await expect(page.locator('#workspace')).toBeHidden();
 await expect.poll(()=>page.evaluate(async u=>{
  try {return (await fetch(u)).ok;}catch{return false;}
 },urls.at(-1)!)).toBe(false);
});

test('transparent PNG export retains decoded alpha and strips metadata',async({page})=>{
 await load(page,'translucent.png','image/png',png(8,4,true));
 await page.locator('#format').selectOption('image/png');
 await page.getByRole('button',{name:'Create image'}).click();
 await expect(page.locator('#download')).toBeVisible();
 const waiting=page.waitForEvent('download');
 await page.getByRole('link',{name:'Download image'}).click();
 const output=await readFile((await (await waiting).path())!);
 expect(inspect(output)).toMatchObject({mime:'image/png',width:8,height:4,metadata:[]});
 const decoded=await page.evaluate(async bytes=>{
  const bitmap=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}));
  try {
   const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
   const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
   ctx.drawImage(bitmap,0,0);
   return [...ctx.getImageData(3,2,1,1).data];
  } finally {bitmap.close();}
 },Array.from(output));
 expect(decoded[3]).toBeGreaterThanOrEqual(126);
 expect(decoded[3]).toBeLessThanOrEqual(130);
 expect(decoded[0]).toBeGreaterThan(195);
 expect(decoded[1]).toBeGreaterThan(45);
 expect(decoded[2]).toBeGreaterThan(105);
});
