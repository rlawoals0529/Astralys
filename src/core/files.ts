export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_PIXELS = 16_000_000;
export const MAX_DIMENSION = 8192;
export type ImageMime = 'image/png' | 'image/jpeg' | 'image/webp';
export type FileKind = ImageMime | 'application/pdf' | 'unsupported';
export interface ImageInfo { mime: ImageMime; width: number; height: number; metadata: string[]; warning: string; }
const text = (a: Uint8Array, start: number, count: number) => String.fromCharCode(...a.subarray(start, start + count));
const fail = (message = 'This file is malformed or incomplete. Try exporting a fresh copy.') => { throw new Error(message); };
const view = (a: Uint8Array) => new DataView(a.buffer, a.byteOffset, a.byteLength);
export function detect(a: Uint8Array): FileKind {
  if (a.length >= 8 && a[0] === 137 && text(a, 1, 7) === 'PNG\r\n\x1a\n') return 'image/png';
  if (a.length >= 3 && a[0] === 255 && a[1] === 216 && a[2] === 255) return 'image/jpeg';
  if (a.length >= 12 && text(a, 0, 4) === 'RIFF' && text(a, 8, 4) === 'WEBP') return 'image/webp';
  if (text(a, 0, 5) === '%PDF-') return 'application/pdf';
  return 'unsupported';
}
export function checkSize(size: number) {
  if (!Number.isSafeInteger(size) || size <= 0) fail('This file is empty. Choose a PNG, JPEG or WebP image.');
  if (size > MAX_FILE_BYTES) fail('This file exceeds the 20 MiB limit. Choose a smaller image.');
}
export function checkDimensions(width: number, height: number) {
  if (![width, height].every(n => Number.isSafeInteger(n) && n > 0)) fail('Image dimensions must be positive whole numbers.');
  if (width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) fail('This image exceeds the limit of 16 million pixels or 8192 pixels per side.');
}
export function mismatch(mime: ImageMime, name: string, declared: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  const expected: Record<ImageMime, string[]> = { 'image/png': ['png'], 'image/jpeg': ['jpg', 'jpeg'], 'image/webp': ['webp'] };
  return (declared && declared !== mime) || !expected[mime].includes(ext ?? '')
    ? 'The file name or reported type does not match its contents. Astralys is using the detected image format.' : '';
}
interface Chunk { type: string; start: number; data: number; end: number; size: number; }
function pngChunks(a: Uint8Array): Chunk[] {
  const chunks: Chunk[] = []; const d = view(a); let offset = 8;
  while (offset < a.length) {
    if (offset + 12 > a.length) fail();
    const size = d.getUint32(offset); const end = offset + 12 + size;
    if (end > a.length) fail();
    const type = text(a, offset + 4, 4);
    // PNG chunk types must be four ASCII letters; the reserved third byte must be uppercase.
    if (!/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type)) fail('This PNG contains an invalid chunk type. Export a compatible copy.');
    // Unknown critical chunks cannot be safely decoded or silently discarded.
    if (/^[A-Z]/.test(type) && !['IHDR', 'PLTE', 'IDAT', 'IEND'].includes(type)) fail('This PNG contains an unsupported critical chunk. Export a compatible copy.');
    // Validate each PNG chunk's CRC before trusting its structure or copying bytes.
    let crc = 0xffffffff;
    for (let i = offset + 4; i < end - 4; i++) {
      crc ^= a[i];
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    if (((crc ^ 0xffffffff) >>> 0) !== d.getUint32(end - 4)) fail('This PNG has a damaged chunk checksum. Export a fresh copy.');
    if (chunks.length >= 4096) fail('Too many image chunks. Export a simpler copy.');
    chunks.push({ type, start: offset, data: offset + 8, end, size });
    offset = end;
    if (type === 'IEND') { if (size !== 0 || offset !== a.length) fail(); break; }
  }
  if (chunks.filter(c=>c.type==='IHDR').length !== 1 || chunks[0]?.type !== 'IHDR' || chunks[0].size !== 13 || chunks.at(-1)?.type !== 'IEND' || !chunks.some(c => c.type === 'IDAT')) fail();
  // Validate IHDR color mode and palette requirements before trusting browser decoding.
  const bitDepth = a[24], colorType = a[25];
  const allowedDepths: Record<number, number[]> = { 0: [1,2,4,8,16], 2: [8,16], 3: [1,2,4,8], 4: [8,16], 6: [8,16] };
  if (!allowedDepths[colorType]?.includes(bitDepth) || a[26] !== 0 || a[27] !== 0 || a[28] !== 0) fail('This PNG has unsupported image header settings. Export a fresh copy.');
  const paletteChunk = chunks.find(c => c.type === 'PLTE');
  if (colorType === 3 && !paletteChunk) fail('This indexed PNG is missing its palette. Export a fresh copy.');
  if (paletteChunk && (colorType === 0 || colorType === 4 || paletteChunk.size === 0 || paletteChunk.size % 3 !== 0 || paletteChunk.size > 768 || (colorType === 3 && paletteChunk.size / 3 > 2 ** bitDepth))) fail('This PNG has an invalid palette. Export a fresh copy.');
  // PNG permits at most one palette, before image data, and requires contiguous IDAT chunks.
  const palette = chunks.findIndex(c => c.type === 'PLTE');
  const firstData = chunks.findIndex(c => c.type === 'IDAT');
  const lastData = chunks.reduce((last, c, i) => c.type === 'IDAT' ? i : last, -1);
  if (chunks.filter(c => c.type === 'PLTE').length > 1 || (palette !== -1 && palette > firstData)) fail('This PNG has invalid critical chunk ordering. Export a fresh copy.');
  if (chunks.slice(firstData, lastData + 1).some(c => c.type !== 'IDAT')) fail('This PNG has noncontiguous image data. Export a fresh copy.');
  return chunks;
}
function webpChunks(a: Uint8Array): Chunk[] {
  const chunks: Chunk[] = []; const d = view(a); let offset = 12;
  if (d.getUint32(4, true) + 8 !== a.length) fail();
  while (offset < a.length) {
    if (offset + 8 > a.length) fail();
    const size = d.getUint32(offset + 4, true), end = offset + 8 + size + (size % 2);
    if (end > a.length) fail();
    if (chunks.length >= 4096) fail('Too many image chunks. Export a simpler copy.');
    chunks.push({ type: text(a, offset, 4), start: offset, data: offset + 8, end, size }); offset = end;
  }
  if (chunks.filter(c => c.type === 'VP8 ' || c.type === 'VP8L').length !== 1 || chunks.filter(c=>c.type==='VP8X').length > 1 || (chunks.some(c=>c.type==='VP8X') && chunks[0].type!=='VP8X')) fail();
  return chunks;
}
function jpegSegments(a: Uint8Array): Chunk[] {
  const chunks: Chunk[] = []; const d = view(a); let offset = 2;
  while (offset < a.length) {
    const start = offset;
    if (a[offset++] !== 255) fail();
    while (a[offset] === 255) offset++;
    const marker = a[offset++];
    if (marker === undefined || marker === 0 || marker === 216 || marker === 217) fail();
    if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
    if (offset + 2 > a.length) fail();
    const size = d.getUint16(offset); if (size < 2 || offset + size > a.length) fail();
    if (chunks.length >= 4096) fail('Too many JPEG segments.');
    chunks.push({ type: marker.toString(16), start, data: offset + 2, end: offset + size, size: size - 2 });
    offset += size;
    if (marker === 218) return chunks;
  }
  return fail();
}
export function inspect(a: Uint8Array, name = '', declared = ''): ImageInfo {
  checkSize(a.length); const mime = detect(a); const d = view(a);
  let width = 0, height = 0; const metadata: string[] = [];
  if (mime === 'image/png') {
    const chunks = pngChunks(a);
    if (chunks.some(c => c.type === 'acTL')) fail('Animated PNG is not supported yet. Choose a still image.');
    width = d.getUint32(16); height = d.getUint32(20);
    for (const c of chunks) if (!['IHDR','PLTE','IDAT','IEND','tRNS'].includes(c.type)) metadata.push(c.type);
  } else if (mime === 'image/jpeg') {
    const segments=jpegSegments(a);
    if(segments.filter(c=>[0xc0,0xc1,0xc2].includes(parseInt(c.type,16))).length!==1) fail();
    for (const c of segments) {
      const m = parseInt(c.type, 16);
      if ([0xc0,0xc1,0xc2].includes(m)) { if (c.size < 6) fail(); height = d.getUint16(c.data + 1); width = d.getUint16(c.data + 3); }
      if ((m >= 0xe1 && m <= 0xef) || m === 0xfe) metadata.push(m === 0xfe ? 'Comment' : `APP${m - 0xe0}`);
    }
  } else if (mime === 'image/webp') {
    for (const c of webpChunks(a)) {
      const i = c.data;
      if (c.type === 'ANIM' || c.type === 'ANMF' || (c.type === 'VP8X' && (a[i] & 2))) fail('Animated WebP is not supported yet. Choose a still image.');
      if (c.type === 'VP8X') { if (c.size !== 10) fail(); width = 1 + a[i+4] + a[i+5]*256 + a[i+6]*65536; height = 1 + a[i+7] + a[i+8]*256 + a[i+9]*65536; }
      if (c.type === 'VP8 ') { if (c.size < 10 || text(a,i+3,3) !== '\x9d\x01\x2a') fail(); const w = d.getUint16(i+6,true) & 16383, h = d.getUint16(i+8,true) & 16383; checkDimensions(w,h); if(width && (width!==w || height!==h)) fail(); width=w; height=h; }
      if (c.type === 'VP8L') { if (c.size < 5 || a[i] !== 47) fail(); const bits = d.getUint32(i+1,true); const w = (bits & 16383) + 1, h = ((bits >>> 14) & 16383) + 1; checkDimensions(w,h); if(width && (width!==w || height!==h)) fail(); width=w; height=h; }
      if (['EXIF','XMP ','ICCP'].includes(c.type)) metadata.push(c.type.trim());
    }
  } else if (mime === 'application/pdf') return fail('PDF detected. existing PDF editing is not supported. This file has not been opened or uploaded.');
  else return fail('This format is not supported yet. Choose a still PNG, JPEG or WebP image. SVG is not opened.');
  checkDimensions(width, height);
  return { mime, width, height, metadata: [...new Set(metadata)], warning: mismatch(mime, name, declared) };
}
// Only accepts freshly encoded browser output; not a general-purpose untrusted-file sanitizer.
export function stripEncodedMetadata(a: Uint8Array, mime: ImageMime): Uint8Array {
  if (detect(a) !== mime) fail('Your browser could not encode the selected format. Try PNG.');
  let parts: Uint8Array[];
  if (mime === 'image/png') parts = [a.slice(0,8), ...pngChunks(a).filter(c => ['IHDR','PLTE','IDAT','IEND','tRNS'].includes(c.type)).map(c=>a.slice(c.start,c.end))];
  else if (mime === 'image/jpeg') {
    const segments = jpegSegments(a); const last = segments.at(-1)!;
    parts = [a.slice(0,2), ...segments.filter(c=> { const m=parseInt(c.type,16); return !(m>=0xe1 && m<=0xef) && m!==0xfe; }).map(c=>a.slice(c.start,c.end)), a.slice(last.end)];
  } else {
    parts = [a.slice(0,12), ...webpChunks(a).filter(c=>['VP8X','VP8 ','VP8L','ALPH'].includes(c.type)).map(c=> { const p=a.slice(c.start,c.end); if(c.type==='VP8X') p[8] &= ~0x2c; return p; })];
  }
  const result = new Uint8Array(parts.reduce((n,p)=>n+p.length,0)); let offset=0;
  for(const p of parts) { result.set(p,offset); offset+=p.length; }
  if(mime==='image/webp') view(result).setUint32(4,result.length-8,true);
  return result;
}
export function safeName(name: string, mime: ImageMime | 'application/pdf'): string {
  const stem = name.replace(/\.[^.]*$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0,80) || 'image';
  return `${stem}-astralys.${mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1]}`;
}
export function suggestedActions(mime: ImageMime) {
  return ['Open in Photo', mime === 'image/webp' ? 'Convert to PNG' : 'Convert to WebP', 'Resize', 'Remove metadata', 'Convert to PDF'] as const;
}
