/** Original synthetic TIFF/JPEG metadata; no camera files or third-party assets. */
export function orientationTiff(orientation: number, little = true): Buffer {
  const tiff = Buffer.alloc(26);
  tiff.write(little ? 'II' : 'MM');
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  view.setUint16(2, 42, little); view.setUint32(4, 8, little);
  view.setUint16(8, 1, little); view.setUint16(10, 0x0112, little);
  view.setUint16(12, 3, little); view.setUint32(14, 1, little);
  view.setUint16(18, orientation, little);
  return tiff;
}
export function withOrientation(jpeg: Uint8Array, orientation: number, little = true): Buffer {
  const payload = Buffer.concat([Buffer.from('Exif\0\0'), orientationTiff(orientation, little)]);
  const marker = Buffer.from([255, 225, 0, 0]); marker.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([jpeg.subarray(0, 2), marker, payload, jpeg.subarray(2)]);
}
