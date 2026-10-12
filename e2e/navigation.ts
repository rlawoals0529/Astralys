import { expect, errors } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';

export async function openApp(page: Page, browserName: string, testInfo: TestInfo) {
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
}
