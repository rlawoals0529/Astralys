import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'spikes/photocraft',testMatch:['browser.spec.ts','composite.spec.ts'],timeout:30_000,projects:[{name:'chromium',use:{browserName:'chromium',channel:'chromium'}},{name:'firefox',use:{browserName:'firefox'}}]});
