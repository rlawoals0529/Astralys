/** Capture local-only frontend screenshots for design review. No deployment. */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true });
try {
  await mkdir('artifacts/design-preview', { recursive: true });
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
    { name: 'small-mobile', width: 320, height: 720 },
    { name: 'tablet', width: 768, height: 1024 },
  ]) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
    try {
      await page.goto(process.env.ASTRALYS_BASE_URL ?? 'http://127.0.0.1:4173', { waitUntil: 'networkidle' });
      await page.locator('#heading').waitFor({ state: 'visible' });
      await page.evaluate(() => document.fonts.ready);
      const homeOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (homeOverflow) throw new Error(`${viewport.name}: homepage overflows horizontally`);
      await page.screenshot({ path: `artifacts/design-preview/${viewport.name}-home.png`, fullPage: true, animations: 'disabled' });
      await page.locator('#sample').click();
      await page.locator('#workspace').waitFor({ state: 'visible' });
      await page.locator('#export-form').waitFor({ state: 'visible' });
      await page.locator('#preview').waitFor({ state: 'visible' });
      await page.waitForFunction(() => {
        const img = document.querySelector('#preview');
        return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0;
      }, null, { timeout: 15000 });
      await page.evaluate(() => document.fonts.ready);
      const workspaceOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (workspaceOverflow) throw new Error(`${viewport.name}: workspace overflows horizontally`);
      await page.screenshot({ path: `artifacts/design-preview/${viewport.name}-workspace.png`, fullPage: true, animations: 'disabled' });
      const interactive = page.locator('#export-form');
      await interactive.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `artifacts/design-preview/${viewport.name}-export.png`, animations: 'disabled' });
      const activeNavigation = page.locator('.sidebar nav [aria-current="page"]');
      if (await activeNavigation.count() !== 1) throw new Error(`${viewport.name}: expected exactly one current workspace navigation item`);
      const horizontalClip = await page.evaluate(() => {
        const rect = document.querySelector('#export-form')?.getBoundingClientRect();
        return rect ? rect.left < -1 || rect.right > window.innerWidth + 1 : true;
      });
      if (horizontalClip) throw new Error(`${viewport.name}: export form extends outside viewport`);
      if (viewport.width <= 650) {
        const controls = page.locator('#export-form input, #export-form select, #export-form button');
        for (let i = 0; i < await controls.count(); i++) {
          const control = controls.nth(i);
          if (!(await control.isVisible())) continue;
          const box = await control.boundingBox();
          const minimumWidth = (await control.getAttribute('type')) === 'checkbox' ? 20 : 24;
          if (box && box.width < minimumWidth) {
            const detail = await control.evaluate((element) => `${element.tagName.toLowerCase()}#${element.id || '(no id)'}[type=${element.getAttribute('type') || 'n/a'}]`);
            throw new Error(`${viewport.name}: export control ${i} (${detail}) is only ${Math.round(box.width)}px wide`);
          }
        }
      }
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
