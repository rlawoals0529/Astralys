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
      await page.screenshot({ path: `artifacts/design-preview/${viewport.name}-home.png`, fullPage: true, animations: 'disabled' });
      await page.locator('#sample').click();
      await page.locator('#workspace').waitFor({ state: 'visible' });
      await page.screenshot({ path: `artifacts/design-preview/${viewport.name}-workspace.png`, fullPage: true, animations: 'disabled' });
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
