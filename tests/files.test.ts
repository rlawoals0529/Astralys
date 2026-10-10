import { describe,expect,it } from 'vitest';
import { checkDimensions,checkSize,detect,inspect,MAX_FILE_BYTES,safeName,stripEncodedMetadata,suggestedActions } from '../src/core/files';
import { png,chunk } from './fixtures';
describe('untrusted input boundaries',()=>{
 it('detects actual bytes and warns about MIME/extension mismatches',()=>{const i=inspect(png(),'attack.html','text/html');expect(i.mime).toBe('image/png');expect(i.warning).toContain('does not match');expect(i.metadata).toContain('tEXt');});
 it('accepts absent reported MIME when extension matches',()=>expect(inspect(png(),'photo.png','').warning).toBe(''));
 it('rejects empty and oversize files, permits exact byte limit',()=>{expect(()=>checkSize(0)).toThrow('empty');expect(()=>checkSize(MAX_FILE_BYTES+1)).toThrow('20 MiB');expect(()=>checkSize(MAX_FILE_BYTES)).not.toThrow();});
 it.each([[0,1],[-1,2],[Infinity,1],[1.2,10],[8193,1],[4001,4000]])('rejects unsafe dimensions %s x %s',(w,h)=>expect(()=>checkDimensions(w,h)).toThrow());
 it('accepts pixel boundary',()=>expect(()=>checkDimensions(4000,4000)).not.toThrow());
 it.each([new Uint8Array(),new Uint8Array([137,80]),png().subarray(0,35),png().subarray(0,-1),new Uint8Array([255,216,255,0xe1,255,255])])('rejects malformed input',bytes=>expect(()=>inspect(bytes)).toThrow());
 it('never accepts SVG as raster even when declared PNG',()=>expect(()=>inspect(Buffer.from('<svg onload="alert(1)"/>'),'a.png','image/png')).toThrow('not supported'));
 it('recognizes PDF without opening it',()=>{const p=Buffer.from('%PDF-1.7\n');expect(detect(p)).toBe('application/pdf');expect(()=>inspect(p)).toThrow('has not been opened');});
 it('rejects APNG',()=>{const p=png();expect(()=>inspect(Buffer.concat([p.subarray(0,33),chunk('acTL',Buffer.alloc(8)),p.subarray(33)]))).toThrow('Animated PNG');});
 it('removes PNG metadata without echoing values',()=>{const output=stripEncodedMetadata(png(),'image/png');expect(inspect(output).metadata).toEqual([]);expect(Buffer.from(output).includes(Buffer.from('PRIVATE'))).toBe(false);expect(inspect(output).width).toBe(8);});
 it('sanitizes names to bounded basenames with actual extension',()=>{const n=safeName('../../<img onerror=alert(1)>\u202E.exe','image/png');expect(n).toMatch(/^[a-zA-Z0-9_-]+\.png$/);expect(n).not.toContain('..');expect(safeName('x'.repeat(500)+'.jpg','image/jpeg').length).toBeLessThan(100);});
 it('only suggests implemented actions',()=>expect(suggestedActions('image/png')).toEqual(['Open in Photo','Convert to WebP','Resize','Remove metadata','Convert to PDF']));
});

function riff(chunks: [string,Uint8Array][]) {
 const parts=chunks.map(([name,payload])=>{const c=Buffer.alloc(8+payload.length+(payload.length%2));c.write(name);c.writeUInt32LE(payload.length,4);c.set(payload,8);return c;});
 const header=Buffer.alloc(12);header.write('RIFF');header.writeUInt32LE(4+parts.reduce((n,p)=>n+p.length,0),4);header.write('WEBP',8);return Buffer.concat([header,...parts]);
}
it('bounds WebP actual bitstream dimensions even with a small extended header',()=>{
 const ext=Buffer.alloc(10);const image=Buffer.alloc(10);image.set([0x9d,0x01,0x2a],3);image.writeUInt16LE(9000,6);image.writeUInt16LE(2,8);
 expect(()=>inspect(riff([['VP8X',ext],['VP8 ',image]]))).toThrow('exceeds');
});
it('rejects animated WebP before native decoding',()=>{
 const ext=Buffer.alloc(10);ext[0]=2;const image=Buffer.alloc(5);image[0]=47;
 expect(()=>inspect(riff([['VP8X',ext],['VP8L',image]]))).toThrow('Animated WebP');
});
it('rejects duplicated PNG dimension headers',()=>{const p=png();expect(()=>inspect(Buffer.concat([p.subarray(0,33),p.subarray(8,33),p.subarray(33)]))).toThrow('malformed');});
it('caps metadata chunk count instead of allocating unbounded records',()=>{const p=png();expect(()=>inspect(Buffer.concat([p.subarray(0,33),...Array.from({length:4097},()=>chunk('tEXt',new Uint8Array())),p.subarray(33)]))).toThrow('Too many');});
it('strips JPEG application metadata while retaining frame and scan bytes',()=>{
 const jpg=Buffer.from([255,216,255,225,0,6,69,88,73,70,255,192,0,8,8,0,1,0,2,1,255,218,0,2,1,2,3,255,217]);
 expect(inspect(jpg).metadata).toEqual(['APP1']);const clean=stripEncodedMetadata(jpg,'image/jpeg');expect(inspect(clean).metadata).toEqual([]);expect(inspect(clean).width).toBe(2);
});
it('strips WebP metadata and repairs RIFF length and VP8X flags',()=>{
 const ext=Buffer.alloc(10);ext[0]=0x0c;const bits=Buffer.from([47,0,0,0,0]);const p=riff([['VP8X',ext],['VP8L',bits],['EXIF',Buffer.from('private')],['XMP ',Buffer.from('private')]]);
 const clean=stripEncodedMetadata(p,'image/webp');expect(inspect(clean).metadata).toEqual([]);expect(Buffer.from(clean).readUInt32LE(4)+8).toBe(clean.length);
});
