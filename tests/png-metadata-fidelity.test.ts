import { describe, expect, it } from 'vitest';
import { chunk, png } from './fixtures';
import { inspect, stripEncodedMetadata } from '../src/core/files';
import { pngWithMetadataContainers } from './fixtures';

describe('PNG metadata container fidelity', () => {
 it('reports ICC, EXIF and text containers without exposing their contents', () => {
  const source = pngWithMetadataContainers();
  const info = inspect(source, 'camera.png', 'image/png');
  expect(info.mime).toBe('image/png');
  expect(info.width).toBe(8);
  expect(info.height).toBe(4);
  expect(info.metadata).toEqual(expect.arrayContaining(['iCCP', 'eXIf', 'tEXt']));
  expect(JSON.stringify(info)).not.toContain('private fixture marker');
 });
 it('removes ancillary metadata while retaining the original encoded image data', () => {
  const source = pngWithMetadataContainers();
  const cleaned = stripEncodedMetadata(source, 'image/png');
  const info = inspect(cleaned, 'clean.png', 'image/png');
  expect(info.metadata).toEqual([]);
  expect(info.width).toBe(8);
  expect(info.height).toBe(4);
  expect(Buffer.from(cleaned).includes(Buffer.from('private fixture marker'))).toBe(false);
  // Structural metadata removal is not proof of correct ICC color rendering.
  expect(cleaned.length).toBeLessThan(source.length);
 });

 it('is idempotent when stripping already sanitized PNG output', () => {
  const once = stripEncodedMetadata(pngWithMetadataContainers(), 'image/png');
  const twice = stripEncodedMetadata(once, 'image/png');
  expect(Buffer.from(twice).equals(Buffer.from(once))).toBe(true);
  expect(inspect(twice, 'clean.png', 'image/png').metadata).toEqual([]);
 });
 it('does not mutate the caller-owned PNG input bytes', () => {
  const source = pngWithMetadataContainers();
  const snapshot = Buffer.from(source);
  const cleaned = stripEncodedMetadata(source, 'image/png');
  expect(Buffer.from(source).equals(snapshot)).toBe(true);
  expect(Buffer.from(cleaned).equals(snapshot)).toBe(false);
 });

 it('preserves valid CRCs and exact image bytes across metadata removal', () => {
  const original = pngWithMetadataContainers();
  const clean = stripEncodedMetadata(original, 'image/png');
  const originalIdat = original.indexOf(Buffer.from('IDAT'));
  const cleanIdat = Buffer.from(clean).indexOf(Buffer.from('IDAT'));
  expect(originalIdat).toBeGreaterThan(0);
  expect(cleanIdat).toBeGreaterThan(0);
  const originalLength = original.readUInt32BE(originalIdat - 4);
  const cleanLength = Buffer.from(clean).readUInt32BE(cleanIdat - 4);
  expect(cleanLength).toBe(originalLength);
  expect(Buffer.from(clean).subarray(cleanIdat, cleanIdat + cleanLength + 8).equals(original.subarray(originalIdat, originalIdat + originalLength + 8))).toBe(true);
 });
 it('rejects corrupted PNG chunk checksums before inspecting or sanitizing', () => {
  const damaged = Buffer.from(pngWithMetadataContainers());
  // Flip one byte in IHDR dimensions while retaining its original CRC.
  damaged[19] ^= 1;
  expect(() => inspect(damaged, 'bad.png', 'image/png')).toThrow(/checksum/);
  expect(() => stripEncodedMetadata(damaged, 'image/png')).toThrow(/checksum/);
 });

 it('rejects an unknown PNG critical chunk even with a valid CRC', () => {
  const source = pngWithMetadataContainers();
  const ihdrEnd = 33;
  const body = Buffer.from([1, 2, 3]);
  const type = Buffer.from('ABCD');
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([type, body])) {
   crc ^= byte;
   for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  const extra = Buffer.alloc(12 + body.length);
  extra.writeUInt32BE(body.length, 0);
  extra.set(type, 4); extra.set(body, 8);
  extra.writeUInt32BE((crc ^ 0xffffffff) >>> 0, extra.length - 4);
  const invalid = Buffer.concat([source.subarray(0, ihdrEnd), extra, source.subarray(ihdrEnd)]);
  expect(() => inspect(invalid, 'unknown.png', 'image/png')).toThrow(/unsupported critical chunk/);
  expect(() => stripEncodedMetadata(invalid, 'image/png')).toThrow(/unsupported critical chunk/);
 });

 it('rejects invalid PNG chunk type bytes and a lowercase reserved letter', () => {
  const source = Buffer.from(pngWithMetadataContainers());
  const firstChunkAfterIHDR = 33;
  for (const type of ['texT', 't1Xt']) {
   const damaged = Buffer.from(source);
   damaged.write(type, firstChunkAfterIHDR + 4, 'ascii');
   const size = damaged.readUInt32BE(firstChunkAfterIHDR);
   const end = firstChunkAfterIHDR + 12 + size;
   let crc = 0xffffffff;
   for (const byte of damaged.subarray(firstChunkAfterIHDR + 4, end - 4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
   }
   damaged.writeUInt32BE((crc ^ 0xffffffff) >>> 0, end - 4);
   expect(() => inspect(damaged, 'bad.png', 'image/png')).toThrow(/invalid chunk type/);
   expect(() => stripEncodedMetadata(damaged, 'image/png')).toThrow(/invalid chunk type/);
  }
 });

 it('rejects duplicate palettes, late palettes and separated IDAT chunks', () => {
  const base = png(8, 4, false);
  const header = base.subarray(0, 33);
  const imageData = base.subarray(33, base.length - 12);
  const end = base.subarray(base.length - 12);
  const palette = chunk('PLTE', Buffer.from([0, 0, 0]));
  const note = chunk('tEXt', Buffer.from('Note\\0between IDAT'));
  const cases = [
   Buffer.concat([header, palette, palette, imageData, end]),
   Buffer.concat([header, imageData, palette, end]),
   Buffer.concat([header, imageData, note, imageData, end]),
  ];
  for (const bytes of cases) {
   expect(() => inspect(bytes, 'bad.png', 'image/png')).toThrow(/critical chunk ordering|noncontiguous image data/);
   expect(() => stripEncodedMetadata(bytes, 'image/png')).toThrow(/critical chunk ordering|noncontiguous image data/);
  }
 });
});
