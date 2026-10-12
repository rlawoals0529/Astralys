import { describe, expect, it } from 'vitest';
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

 it('rejects corrupted PNG chunk checksums before inspecting or sanitizing', () => {
  const damaged = Buffer.from(pngWithMetadataContainers());
  // Flip one byte in IHDR dimensions while retaining its original CRC.
  damaged[19] ^= 1;
  expect(() => inspect(damaged, 'bad.png', 'image/png')).toThrow(/checksum/);
  expect(() => stripEncodedMetadata(damaged, 'image/png')).toThrow(/checksum/);
 });
});
