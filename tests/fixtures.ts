import { deflateSync } from 'node:zlib';
export function crc32(bytes: Uint8Array) {let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
export function chunk(type:string,body:Uint8Array) {const name=Buffer.from(type);const b=Buffer.alloc(body.length+12);b.writeUInt32BE(body.length,0);name.copy(b,4);b.set(body,8);b.writeUInt32BE(crc32(b.subarray(4,-4)),b.length-4);return b;}
export function png(width=8,height=4,metadata=true) {
 const h=Buffer.alloc(13);h.writeUInt32BE(width,0);h.writeUInt32BE(height,4);h[8]=8;h[9]=6;
 const pixels=Buffer.alloc(height*(width*4+1));for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*(width*4+1)+1+x*4;pixels.set([210,60,120,128],i);}
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),...(metadata?[chunk('tEXt',Buffer.from('Comment\0<script>alert(1)</script> GPS PRIVATE'))]:[]),chunk('IDAT',deflateSync(pixels)),chunk('IEND',new Uint8Array())]);
}
