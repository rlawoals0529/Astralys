import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const wasmPath = 'spikes/photocraft/target/wasm32-unknown-unknown/release/astralys_photo_spike.wasm';
const workerPath = 'spikes/photocraft/composite.worker.js';

test('multi-tile image blend handles edge tiles, parity, and measured linear memory', async ({page}, testInfo) => {
  const wasm = Array.from(await readFile(wasmPath));
  const script = await readFile(workerPath, 'utf8');
  const result = await page.evaluate(async ({wasm, script}) => {
    const url = URL.createObjectURL(new Blob([script], {type: 'text/javascript'}));
    const worker = new Worker(url);
    const width = 129, height = 65;
    const length = width * height * 4;
    const backdrop = new Uint8Array(length);
    const source = new Uint8Array(length);
    for (let i = 0; i < length; i += 4) {
      backdrop.set([200, 100, 50, 255], i);
      source.set([100, 200, 50, 255], i);
    }
    // Different pixels at top-left and bottom-right exercise alpha and edges.
    source[3] = 0;
    source[length - 1] = 0;
    try {
      return await new Promise<unknown>((resolve, reject) => {
        const progress: number[] = [];
        const timer = setTimeout(() => reject(new Error('multi-tile worker timeout')), 10000);
        worker.onmessage = event => {
          const message = event.data;
          if (message.type === 'progress') { progress.push(message.completedTiles); return; }
          clearTimeout(timer);
          if (message.type !== 'result') { reject(new Error(JSON.stringify(message))); return; }
          const pixels = new Uint8Array(message.pixels);
          let incorrectPixels = 0;
          for (let i = 0; i < length; i += 4) {
            const expected = (i === 0 || i === length - 4) ? [200, 100, 50, 255] : [78, 78, 10, 255];
            for (let channel = 0; channel < 4; channel++) {
              if (pixels[i + channel] !== expected[channel]) incorrectPixels++;
            }
          }
          resolve({incorrectPixels, progress, metrics: message.metrics,
            originalBackdrop: Array.from(backdrop.slice(0, 4)),
            originalSource: Array.from(source.slice(0, 4))});
        };
        worker.onerror = () => { clearTimeout(timer); reject(new Error('worker error')); };
        worker.postMessage({type: 'start', jobId: 1, wasm: new Uint8Array(wasm), width, height, mode: 0, opacity: 1, backdrop, source});
      });
    } finally {
      worker.terminate();
      URL.revokeObjectURL(url);
    }
  }, {wasm, script});
  const data = result as {
    incorrectPixels: number;
    progress: number[];
    originalBackdrop: number[];
    originalSource: number[];
    metrics: {width: number; height: number; totalTiles: number; completedTiles: number;
      wasmBinaryBytes: number; wasmLinearInitialBytes: number; wasmLinearFinalBytes: number;
      wasmArenaBytes: number; inputBytes: number; outputBytes: number; elapsedMs: number;};
  };
  expect(data.incorrectPixels).toBe(0);
  expect(data.progress).toEqual([3, 6]);
  expect(data.originalBackdrop).toEqual([200, 100, 50, 255]);
  expect(data.originalSource).toEqual([100, 200, 50, 0]);
  expect(data.metrics).toMatchObject({width: 129, height: 65, totalTiles: 6, completedTiles: 6,
    wasmArenaBytes: 49152, inputBytes: 129 * 65 * 8, outputBytes: 129 * 65 * 4,
    wasmBinaryBytes: wasm.length});
  expect(data.metrics.wasmLinearFinalBytes).toBe(data.metrics.wasmLinearInitialBytes);
  expect(data.metrics.wasmLinearInitialBytes).toBeLessThanOrEqual(4 * 1024 * 1024);
  expect(data.metrics.elapsedMs).toBeGreaterThanOrEqual(0);
  await testInfo.attach('rgba-linear-memory-metrics.json', {
    body: JSON.stringify(data.metrics, null, 2), contentType: 'application/json'
  });
});

test('cancellation interrupts a multi-row job and a fresh worker recovers', async ({page}) => {
  const wasm = Array.from(await readFile(wasmPath));
  const script = await readFile(workerPath, 'utf8');
  const outcome = await page.evaluate(async ({wasm, script}) => {
    const url = URL.createObjectURL(new Blob([script], {type: 'text/javascript'}));
    const messages: string[] = [];
    try {
      const worker = new Worker(url);
      try {
        await new Promise<void>((resolve, reject) => {
          let requestedCancellation = false;
          const timer = setTimeout(() => reject(new Error('cancellation timeout')), 10000);
          worker.onmessage = event => {
            const msg = event.data;
            messages.push(msg.type);
            if (msg.type === 'progress' && !requestedCancellation) {
              requestedCancellation = true;
              worker.postMessage({type: 'cancel', jobId: 8});
            }
            if (msg.type === 'cancelled') {
              clearTimeout(timer);
              resolve();
            }
            if (msg.type === 'result' || msg.type === 'error') {
              clearTimeout(timer);
              reject(new Error('Unexpected completion: ' + msg.type));
            }
          };
          worker.onerror = () => { clearTimeout(timer); reject(new Error('worker crash')); };
          const length = 512 * 512 * 4;
          const backdrop = new Uint8Array(length).fill(255);
          const source = new Uint8Array(length).fill(100);
          worker.postMessage({type: 'start', jobId: 8, width: 512, height: 512,
            mode: 1, opacity: 1, wasm: new Uint8Array(wasm), backdrop, source});
        });
        await new Promise(resolve => setTimeout(resolve, 40));
      } finally { worker.terminate(); }
      const restarted = new Worker(url);
      try {
        const next = await new Promise<unknown>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('restart timeout')), 10000);
          restarted.onmessage = event => {
            if (event.data.type === 'progress') return;
            clearTimeout(timer);
            resolve(event.data);
          };
          restarted.onerror = () => { clearTimeout(timer); reject(new Error('restart worker crash')); };
          restarted.postMessage({type: 'start', jobId: 9, width: 1, height: 1,
            mode: 0, opacity: 1, wasm: new Uint8Array(wasm),
            backdrop: new Uint8Array([255, 0, 0, 255]), source: new Uint8Array([0, 0, 255, 255])});
        });
        const result = next as {type: string; pixels?: ArrayBuffer; metrics?: {totalTiles: number}};
        return {messages, type: result.type, pixel: result.pixels ? Array.from(new Uint8Array(result.pixels)) : null,
          tiles: result.metrics?.totalTiles};
      } finally { restarted.terminate(); }
    } finally { URL.revokeObjectURL(url); }
  }, {wasm, script});
  expect(outcome.messages[0]).toBe('progress');
  expect(outcome.messages.at(-1)).toBe('cancelled');
  expect(outcome.messages.filter(type => type === 'progress').length).toBeGreaterThanOrEqual(1);
  expect(outcome.messages.filter(type => type === 'progress').length).toBeLessThan(8);
  expect(outcome.messages).not.toContain('result');
  expect(outcome.type).toBe('result');
  expect(outcome.pixel).toEqual([0, 0, 0, 255]);
  expect(outcome.tiles).toBe(1);
});

test('image-wide worker rejects malformed inputs and processes maximum geometry without growth', async ({page}, testInfo) => {
  const wasm = Array.from(await readFile(wasmPath));
  const script = await readFile(workerPath, 'utf8');
  const result = await page.evaluate(async ({wasm, script}) => {
    const url = URL.createObjectURL(new Blob([script], {type: 'text/javascript'}));
    const worker = new Worker(url);
    try {
      const send = (job: Record<string, unknown>): Promise<unknown> => new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('bounded job timeout')), 12000);
        worker.onmessage = event => {
          if (event.data.type === 'progress') return;
          clearTimeout(timer);
          resolve(event.data);
        };
        worker.onerror = () => { clearTimeout(timer); reject(new Error('worker crash')); };
        worker.postMessage({type: 'start', wasm: new Uint8Array(wasm), mode: 0, opacity: 1, ...job});
      });
      const short = await send({jobId: 11, width: 2, height: 1,
        backdrop: new Uint8Array(4), source: new Uint8Array(8)});
      const oversize = await send({jobId: 12, width: 513, height: 1,
        backdrop: new Uint8Array(513 * 4), source: new Uint8Array(513 * 4)});
      const badOpacity = await send({jobId: 13, width: 1, height: 1, opacity: Number.NaN,
        backdrop: new Uint8Array(4), source: new Uint8Array(4)});
      const length = 512 * 512 * 4;
      const backdrop = new Uint8Array(length);
      const source = new Uint8Array(length);
      for (let i = 0; i < length; i += 4) {
        backdrop.set([0, 100, 200, 255], i);
        source.set([200, 100, 0, 255], i);
      }
      const full = await send({jobId: 14, width: 512, height: 512, mode: 1, backdrop, source});
      const output = full as {type: string; pixels?: ArrayBuffer; metrics?: {
        totalTiles: number; wasmLinearInitialBytes: number; wasmLinearFinalBytes: number; elapsedMs: number; }};
      const pixels = output.pixels ? new Uint8Array(output.pixels) : new Uint8Array(0);
      return {
        invalid: [short, oversize, badOpacity],
        type: output.type,
        first: Array.from(pixels.slice(0, 4)),
        last: Array.from(pixels.slice(-4)),
        count: pixels.length,
        metrics: output.metrics
      };
    } finally { worker.terminate(); URL.revokeObjectURL(url); }
  }, {wasm, script});
  for (const failure of result.invalid as Array<{type: string; error: string}>) {
    expect(failure).toMatchObject({type: 'error', error: 'Error: Invalid bounded image job'});
  }
  expect(result.type).toBe('result');
  expect(result.count).toBe(512 * 512 * 4);
  expect(result.first).toEqual([200, 161, 200, 255]);
  expect(result.last).toEqual([200, 161, 200, 255]);
  expect(result.metrics?.totalTiles).toBe(64);
  expect(result.metrics?.wasmLinearInitialBytes).toBe(result.metrics?.wasmLinearFinalBytes);
  await testInfo.attach('rgba-max-geometry-metrics.json', {
    body: JSON.stringify(result.metrics, null, 2), contentType: 'application/json'
  });
});
