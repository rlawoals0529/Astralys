import { expect, test } from 'vitest';
import { exifOrientation } from '../src/core/exif';
import { inspect, stripEncodedMetadata } from '../src/core/files';
import { orientationTiff, withOrientation } from './exif-fixtures';

const jpeg = Buffer.from([255,216,255,192,0,8,8,0,32,0,48,1,255,218,0,2,1,2,3,255,217]);
test.each([true, false])('all eight orientations use bounded IFD0, little-endian=%s', little => {
  for (let orientation = 1; orientation <= 8; orientation++) {
    expect(exifOrientation(orientationTiff(orientation, little))).toBe(orientation);
    const bytes = withOrientation(jpeg, orientation, little);
    expect(inspect(bytes)).toMatchObject({width:orientation >= 5 ? 32 : 48, height:orientation >= 5 ? 48 : 32});
    expect(inspect(stripEncodedMetadata(bytes, 'image/jpeg')).metadata).toEqual([]);
  }
});
test('missing orientation defaults to identity; nested IFD pointers are not followed', () => {
  const bytes = orientationTiff(6); bytes.writeUInt16LE(0x8769, 10); bytes.writeUInt32LE(0xffffffff, 22);
  expect(exifOrientation(bytes)).toBe(1);
});
test('malformed TIFF structures and orientation types fail closed', () => {
  const mutations = [
    (b:Buffer)=>b.subarray(0, 7), (b:Buffer)=>{b[0]=0;return b;},
    (b:Buffer)=>{b.writeUInt16LE(43,2);return b;},
    (b:Buffer)=>{b.writeUInt32LE(0xffffffff,4);return b;},
    (b:Buffer)=>{b.writeUInt32LE(0,4);return b;},
    (b:Buffer)=>{b.writeUInt16LE(513,8);return b;},
    (b:Buffer)=>{b.writeUInt16LE(4,12);return b;},
    (b:Buffer)=>{b.writeUInt32LE(2,14);return b;},
    (b:Buffer)=>{b.writeUInt16LE(0,18);return b;},
    (b:Buffer)=>{b.writeUInt16LE(9,18);return b;},
    (b:Buffer)=>b.subarray(0,25),
  ];
  for (const mutate of mutations) expect(()=>exifOrientation(mutate(orientationTiff(6)))).toThrow('Invalid EXIF');
});
test('duplicate orientation tags and EXIF containers are rejected', () => {
  const one=orientationTiff(6), two=Buffer.concat([one.subarray(0,22),one.subarray(10)]);
  two.writeUInt16LE(2,8);
  expect(()=>exifOrientation(two)).toThrow('Invalid EXIF');
  expect(()=>inspect(withOrientation(withOrientation(jpeg,6),1))).toThrow('Multiple EXIF');
});
