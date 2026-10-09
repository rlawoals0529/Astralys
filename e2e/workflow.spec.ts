import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { inspect } from '../src/core/files';
import { png, chunk } from '../tests/fixtures';
async function load(page: import('@playwright/test').Page,name='source.png',mime='image/png',bytes=png()) {await page.locator('#file-input').setInputFiles({name,mimeType:mime,buffer:bytes});await expect(page.locator('#workspace')).toBeVisible();await expect(page.locator('#cancel')).toBeHidden();}
test.beforeEach(async({page})=>{await page.goto('/');});
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
 const animated=Buffer.concat([png().subarray(0,33),chunk('acTL',Buffer.alloc(8)),png().subarray(33)]);
 for(const [name,buffer,message] of [['x.svg',Buffer.from('<svg onload="alert(1)"/>'),'not supported'],['broken.png',png().subarray(0,40),'malformed'],['large.png',large,'exceeds'],['animated.png',animated,'Animated PNG'],['x.pdf',Buffer.from('%PDF-1.7'),'PDF detected']] as const) {
  await page.locator('#file-input').setInputFiles({name,mimeType:'image/png',buffer});await expect(page.locator('#status')).toContainText(message);await expect(page.locator('#download')).toBeHidden();
 }
 await load(page);await expect(page.locator('#status')).toContainText('Image ready');
});
test('size boundary is checked before decode',async({page})=>{
 await page.locator('#file-input').setInputFiles({name:'huge.png',mimeType:'image/png',buffer:Buffer.alloc(20*1024*1024+1)});await expect(page.locator('#status')).toContainText('20 MiB');await expect(page.locator('#workspace')).toBeHidden();
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
 const requests:string[]=[];page.on('request',r=>requests.push(r.url()));await page.getByRole('button',{name:'Paste a link'}).click();await page.locator('#media-url').fill('https://www.youtube.com/watch?v=test');await page.getByRole('button',{name:'Check link'}).click();await expect(page.locator('#link-result')).toContainText('gated');await page.locator('#media-url').fill('https://127.0.0.1/private.mp4');await page.getByRole('button',{name:'Check link'}).click();await expect(page.locator('#link-result')).toContainText('not enabled');expect(requests).toEqual([]);
});
test('keyboard navigation and focus, category honesty, reduced motion and mobile layout',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.keyboard.press('Tab');await expect(page.getByText('Skip to workspace')).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('#main')).toBeFocused();
 await page.getByRole('button',{name:'PDF',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.locator('#category-panel')).toContainText('does not open');
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
