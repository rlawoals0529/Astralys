/** Read only IFD0 orientation. Never follow thumbnail, GPS or nested IFD pointers. */
export function exifOrientation(tiff: Uint8Array): number {
  const invalid = (): never => { throw new Error('Invalid EXIF orientation metadata. Export a fresh copy of this image.'); };
  if (tiff.length < 8) return invalid();
  const little = tiff[0] === 0x49 && tiff[1] === 0x49;
  if (!little && !(tiff[0] === 0x4d && tiff[1] === 0x4d)) return invalid();
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  if (view.getUint16(2, little) !== 42) return invalid();
  const offset = view.getUint32(4, little);
  if (offset < 8 || offset > tiff.length - 2) return invalid();
  const count = view.getUint16(offset, little);
  // Bound both the work and the table, including its next-IFD pointer.
  if (count > 512 || offset + 2 + count * 12 + 4 > tiff.length) return invalid();
  let orientation: number | undefined;
  for (let i = 0; i < count; i++) {
    const entry = offset + 2 + i * 12;
    if (view.getUint16(entry, little) !== 0x0112) continue;
    if (orientation !== undefined || view.getUint16(entry + 2, little) !== 3 || view.getUint32(entry + 4, little) !== 1) return invalid();
    orientation = view.getUint16(entry + 8, little);
    if (orientation < 1 || orientation > 8) return invalid();
  }
  return orientation ?? 1;
}
