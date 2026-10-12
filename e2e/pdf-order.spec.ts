import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { png } from '../tests/fixtures';
import { openApp } from './navigation';
import { inspect } from '../src/core/files';

const pages=[
  {name:'first.png',mimeType:'image/png',buffer:png(8,4,false)},
  {name:'second.png',mimeType:'image/png',buffer:png(12,6,false)},
  {name:'<img src=x onerror=alert(1)>.png',mimeType:'image/png',buffer:png(16,8,false)},
];
test('loaded image workspace precedes optional multi-file tools in visual and keyboard order',async({page})=>{
  await page.locator('#sample').click();
  await expect(page.locator('#workspace')).toBeVisible();
  for(const width of [320,768,1440]){
    await page.setViewportSize({width,height:900});
    const order=await page.evaluate(()=>{
      const workspace=document.querySelector('#workspace')!,batch=document.querySelector('#batch-panel')!,pdf=document.querySelector('#pdf-pages')!;
      return {dom:!!(workspace.compareDocumentPosition(batch)&Node.DOCUMENT_POSITION_FOLLOWING),
        workspace:workspace.getBoundingClientRect().top,batch:batch.getBoundingClientRect().top,pdf:pdf.getBoundingClientRect().top};
    });
    expect(order.dom).toBe(true);expect(order.workspace).toBeLessThan(order.batch);expect(order.batch).toBeLessThan(order.pdf);
  }
});
test.beforeEach(async({page,browserName},testInfo)=>{
  await openApp(page,browserName,testInfo);
  await page.locator('#pdf-page-files').setInputFiles(pages);
});
test('keyboard page reordering changes downloaded PDF stream order without interpreting names',async({page})=>{
  await expect(page.locator('#pdf-page-order li')).toHaveCount(3);
  await expect(page.locator('#pdf-page-order img')).toHaveCount(0);
  await page.getByRole('button',{name:'Move page 3 up',exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button',{name:'Move page 2 up',exact:true})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button',{name:'Move page 1 down',exact:true})).toBeFocused();
  await expect(page.locator('.pdf-page-name')).toHaveText([pages[2].name,pages[0].name,pages[1].name]);
  await expect(page.getByRole('button',{name:'Move page 1 up',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Move page 3 down',exact:true})).toBeDisabled();
  await page.locator('#pdf-compose').click();
  await expect(page.locator('#pdf-download')).toBeVisible();
  const pending=page.waitForEvent('download');await page.locator('#pdf-download').click();
  const bytes=await readFile((await (await pending).path())!);const text=bytes.toString('latin1');
  const widths=[4,7,10].map(id=>{
    const object=text.indexOf(`${id} 0 obj`),stream=text.indexOf('stream\n',object);
    const length=Number(text.slice(object,stream).match(/\/Length (\d+)/)![1]);
    return inspect(bytes.subarray(stream+7,stream+7+length)).width;
  });
  expect(widths).toEqual([16,8,12]);
  expect(text).not.toContain('onerror');
});
test('removal and resolution changes invalidate old output and recover from an empty selection',async({page})=>{
  await page.locator('#pdf-compose').click();await expect(page.locator('#pdf-download')).toBeVisible();
  await page.locator('#pdf-page-size').selectOption('800');
  await expect(page.locator('#pdf-result')).toBeHidden();
  await expect(page.locator('#pdf-download')).not.toHaveAttribute('href',/blob:/);
  await page.locator('#pdf-compose').click();await expect(page.locator('#pdf-download')).toBeVisible();
  await page.getByRole('button',{name:'Remove page 2',exact:true}).click();
  await expect(page.locator('#pdf-result')).toBeHidden();
  await expect(page.locator('#pdf-download')).not.toHaveAttribute('href',/blob:/);
  await expect(page.getByRole('button',{name:'Remove page 2',exact:true})).toBeFocused();
  await expect(page.locator('#pdf-compose')).toBeEnabled();
  await page.getByRole('button',{name:'Remove page 2',exact:true}).click();
  await expect(page.locator('#pdf-compose')).toBeDisabled();
  await page.getByRole('button',{name:'Remove page 1',exact:true}).click();
  await expect(page.locator('#pdf-page-files')).toBeFocused();
  await expect(page.locator('#pdf-page-order')).toBeEmpty();
  await expect(page.locator('#pdf-page-files')).toHaveValue('');
  await page.locator('#pdf-page-files').setInputFiles(pages.slice(0,2));
  await expect(page.locator('#pdf-page-order li')).toHaveCount(2);
  await expect(page.locator('#pdf-compose')).toBeEnabled();
});
test('page order controls are locked while processing and fit narrow, tablet and desktop layouts',async({page},testInfo)=>{
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.locator('#pdf-pages').screenshot({path:testInfo.outputPath(`pdf-order-${width}.png`)});
  }
  await page.route('**/assets/image.worker-*.js',route=>route.fulfill({contentType:'text/javascript',body:'self.onmessage=()=>{}'}));
  await page.locator('#pdf-compose').click();
  await expect(page.locator('#pdf-cancel')).toBeVisible();
  for(const button of await page.locator('#pdf-page-order button').all()) await expect(button).toBeDisabled();
  await page.locator('#pdf-cancel').click();
  await expect(page.getByRole('button',{name:'Move page 2 up',exact:true})).toBeEnabled();
  await page.locator('#pdf-clear').click();await expect(page.locator('#pdf-page-order')).toBeEmpty();
});
