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
});
