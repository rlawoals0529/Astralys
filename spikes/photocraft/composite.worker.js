// Isolated, original Astralys PhotoCraft experiment. Never imported by production.
// One active local, bounded image job per dedicated worker; no fetch or persistence.
// Host cancellation is cooperative between 64x64 tile rows, or immediate via
// Worker.terminate(). The WASM module bytes come from a trusted local build.
const TILE_SIDE = 64;
const PLANE_BYTES = TILE_SIDE * TILE_SIDE * 4;
const MAX_SIDE = 512;
const MAX_WASM_BYTES = 1024 * 1024;
const MAX_LINEAR_BYTES = 4 * 1024 * 1024;
let active = null;

function validate(job) {
  const {jobId, width, height, mode, opacity, backdrop, source, wasm} = job;
  if (!Number.isSafeInteger(jobId) || jobId < 0 ||
      !Number.isInteger(width) || !Number.isInteger(height) ||
      width < 1 || height < 1 || width > MAX_SIDE || height > MAX_SIDE ||
      (mode !== 0 && mode !== 1) ||
      !Number.isFinite(opacity) || opacity < 0 || opacity > 1 ||
      !(backdrop instanceof Uint8Array) || !(source instanceof Uint8Array) ||
      backdrop.byteLength !== width * height * 4 ||
      source.byteLength !== width * height * 4 ||
      !(wasm instanceof Uint8Array) ||
      wasm.byteLength === 0 || wasm.byteLength > MAX_WASM_BYTES) {
    throw new Error('Invalid bounded image job');
  }
}

async function render(job, state) {
  validate(job);
  const {jobId, width, height, mode, opacity, backdrop, source, wasm} = job;
  const startedAt = performance.now();
  const {instance} = await WebAssembly.instantiate(wasm);
  if (state.cancelled) return;
  const {memory, astralys_tile_ptr: tilePtr, astralys_tile_blend: tileBlend} = instance.exports;
  if (!(memory instanceof WebAssembly.Memory) ||
      typeof tilePtr !== 'function' || typeof tileBlend !== 'function') {
    throw new Error('Unexpected WASM tile exports');
  }
  const ptr = tilePtr();
  const initialLinearBytes = memory.buffer.byteLength;
  if (!Number.isSafeInteger(ptr) || ptr < 0 ||
      initialLinearBytes > MAX_LINEAR_BYTES ||
      ptr + PLANE_BYTES * 3 > initialLinearBytes) {
    throw new Error('WASM tile arena out of bounds');
  }
  const arena = new Uint8Array(memory.buffer, ptr, PLANE_BYTES * 3);
  const pixels = new Uint8Array(width * height * 4);
  const totalTiles = Math.ceil(width / TILE_SIDE) * Math.ceil(height / TILE_SIDE);
  let completedTiles = 0;

  for (let top = 0; top < height; top += TILE_SIDE) {
    for (let left = 0; left < width; left += TILE_SIDE) {
      if (state.cancelled) return;
      const tw = Math.min(TILE_SIDE, width - left);
      const th = Math.min(TILE_SIDE, height - top);
      arena.fill(0, 0, PLANE_BYTES * 2);
      for (let y = 0; y < th; y++) {
        const offset = ((top + y) * width + left) * 4;
        const start = y * tw * 4;
        arena.set(backdrop.subarray(offset, offset + tw * 4), start);
        arena.set(source.subarray(offset, offset + tw * 4), PLANE_BYTES + start);
      }
      if (tileBlend(mode, tw, th, opacity) !== 0) {
        throw new Error('WASM rejected bounded tile');
      }
      for (let y = 0; y < th; y++) {
        const offset = ((top + y) * width + left) * 4;
        const start = PLANE_BYTES * 2 + y * tw * 4;
        pixels.set(arena.subarray(start, start + tw * 4), offset);
      }
      completedTiles++;
    }
    if (state.cancelled) return;
    self.postMessage({type: 'progress', jobId, completedTiles, totalTiles});
    // Give the worker event loop a cancellation opportunity every tile row.
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  if (state.cancelled) return;
  const finalLinearBytes = memory.buffer.byteLength;
  if (finalLinearBytes !== initialLinearBytes) {
    throw new Error('Unexpected WASM memory growth');
  }
  self.postMessage({
    type: 'result', jobId, pixels: pixels.buffer,
    metrics: {
      width, height, totalTiles, completedTiles,
      wasmBinaryBytes: wasm.byteLength,
      wasmLinearInitialBytes: initialLinearBytes,
      wasmLinearFinalBytes: finalLinearBytes,
      wasmArenaBytes: PLANE_BYTES * 3,
      inputBytes: backdrop.byteLength + source.byteLength,
      outputBytes: pixels.byteLength,
      elapsedMs: Math.round((performance.now() - startedAt) * 100) / 100
    }
  }, [pixels.buffer]);
}

self.onmessage = ({data}) => {
  if (data?.type === 'cancel') {
    if (active && active.jobId === data.jobId && !active.cancelled) {
      active.cancelled = true;
      self.postMessage({type: 'cancelled', jobId: active.jobId});
    }
    return;
  }
  if (data?.type !== 'start') {
    self.postMessage({type: 'error', jobId: data?.jobId, error: 'Unknown worker command'});
    return;
  }
  if (active) {
    self.postMessage({type: 'error', jobId: data.jobId, error: 'Worker is busy'});
    return;
  }
  const state = {jobId: data.jobId, cancelled: false};
  active = state;
  void render(data, state)
    .catch(error => {
      if (!state.cancelled) {
        self.postMessage({type: 'error', jobId: data.jobId, error: String(error)});
      }
    })
    .finally(() => {
      if (active === state) active = null;
    });
};
