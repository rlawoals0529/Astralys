import { describe, it, expect } from 'vitest';
import { imagePdf, imagePagesPdf, imagePagesPdfParts } from '../src/core/pdf';
// Original 8×4 synthetic RGB image, generated once for this fixture.
const jpeg=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAAEAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDlKKKK7T+uz//Z','base64');
describe('single-image PDF',()=>{
 it('writes exact xref offsets, page geometry and binary stream lengths',()=>{
  const pdf=Buffer.from(imagePdf(jpeg,8,4)),text=pdf.toString('latin1');
  expect(text.startsWith('%PDF-1.4')).toBe(true);expect(text).toContain('/MediaBox [0 0 6 3]');
  const start=Number(text.match(/startxref\n(\d+)\n%%EOF/)![1]);expect(text.slice(start,start+4)).toBe('xref');
  const lines=text.slice(start).split('\n');expect(lines[1]).toBe('0 6');
  for(let id=1;id<=5;id++){const row=lines[id+2];expect(row.length+1).toBe(20);const offset=Number(row.slice(0,10));expect(text.slice(offset,offset+7)).toBe(`${id} 0 obj`);}
  const imageStart=text.indexOf('stream\n',text.indexOf('4 0 obj'))+7;
  expect(pdf.subarray(imageStart,imageStart+jpeg.length)).toEqual(jpeg);
  expect(text).toContain(`/Length ${jpeg.length}`);expect(text).not.toMatch(/\/(JavaScript|OpenAction|Info|Metadata|EmbeddedFiles|URI)\b/);
 });
 it('is deterministic and does not mutate its encoded image',()=>{const before=Buffer.from(jpeg);expect(imagePdf(jpeg,8,4)).toEqual(imagePdf(jpeg,8,4));expect(jpeg).toEqual(before);});
 it.each([[0,4],[8,-1],[Infinity,4],[8193,1],[8000,8000]])('rejects invalid or oversized geometry %s × %s',(w,h)=>{expect(()=>imagePdf(jpeg,w,h)).toThrow();});
 it('rejects truncated, mismatched and metadata-bearing JPEGs',()=>{
  expect(()=>imagePdf(jpeg.subarray(0,-1),8,4)).toThrow();expect(()=>imagePdf(jpeg,9,4)).toThrow();
  const metadata=Buffer.concat([jpeg.subarray(0,2),Buffer.from([255,225,0,4,65,66]),jpeg.subarray(2)]);expect(()=>imagePdf(metadata,8,4)).toThrow();
 });
 it('rejects unsupported color components and precision',()=>{
  const sof=jpeg.indexOf(Buffer.from([255,192]));expect(sof).toBeGreaterThan(0);
  for(const [offset,value] of [[4,12],[9,4]]){const modified=Buffer.from(jpeg);modified[sof+offset]=value;expect(()=>imagePdf(modified,8,4)).toThrow();}
 });
 it('rejects output near the memory ceiling before parsing',()=>{expect(()=>imagePdf(new Uint8Array(64*1024*1024),8,4)).toThrow('too large');});
});

describe('PDF section assembly without a full output buffer',()=>{
 it('matches contiguous PDF bytes through direct Blob sections while reusing JPEG byte views',async()=>{
  const pages=[{jpeg,width:8,height:4},{jpeg,width:8,height:4}];
  const sections=imagePagesPdfParts(pages);
  expect(sections.filter(part=>part===jpeg)).toHaveLength(2);
  const blob=new Blob(sections as BlobPart[],{type:'application/pdf'});
  const fromBlob=new Uint8Array(await blob.arrayBuffer());
  expect(fromBlob).toEqual(imagePagesPdf(pages));
  expect(blob.type).toBe('application/pdf');
  expect(blob.size).toBe(fromBlob.length);
  const text=Buffer.from(fromBlob).toString('latin1');
  const xref=Number(text.match(/startxref\\n(\\d+)\\n%%EOF/)![1]);
  expect(text.slice(xref,xref+4)).toBe('xref');
 });
 it('rejects malformed pages before offering sections',()=>{
  expect(()=>imagePagesPdfParts([{jpeg,width:8,height:4}])).toThrow('2 to 8');
  expect(()=>imagePagesPdfParts([{jpeg,width:8,height:4},{jpeg:jpeg.subarray(0,-1),width:8,height:4}])).toThrow();
 });
});

describe('multi-image page PDF composition from freshly sanitized JPEG pages',()=>{
 it('emits deterministic two-page PDF object graph with exact xref offsets and matching JPEG bytes',()=>{
   const p={jpeg,width:8,height:4};
   const original=Buffer.from(jpeg);
   const bytes=Buffer.from(imagePagesPdf([p,p])),text=bytes.toString('latin1');
   expect(text).toContain('/Count 2');
   expect(text).toContain('/Kids [3 0 R 6 0 R]');
   expect(text).toContain('/MediaBox [0 0 6 3]');
   expect(text.match(/\/Type \/Page \/Parent/g)).toHaveLength(2);
   expect(text.match(/\/Subtype \/Image/g)).toHaveLength(2);
   expect(text).not.toMatch(/\/(?:JavaScript|OpenAction|Metadata|EmbeddedFiles|URI)\b/);
   const start=Number(text.match(/startxref\n(\d+)\n%%EOF/)![1]);
   const rows=text.slice(start).split('\n');
   expect(rows[0]).toBe('xref');expect(rows[1]).toBe('0 9');
   for(let id=1;id<=8;id++){
     const offset=Number(rows[id+2].slice(0,10));
     expect(text.slice(offset,offset+7)).toBe(`${id} 0 obj`);
   }
   for(const id of [4,7]){
     const at=text.indexOf('stream\n',text.indexOf(`${id} 0 obj`))+7;
     expect(bytes.subarray(at,at+jpeg.length)).toEqual(jpeg);
   }
   expect(jpeg).toEqual(original);
   expect(imagePagesPdf([p,p])).toEqual(imagePagesPdf([p,p]));
 });
 it('refuses empty, single, too many, malformed, mismatched or metadata-bearing pages',()=>{
   const page={jpeg,width:8,height:4};
   expect(()=>imagePagesPdf([])).toThrow('2 to 8');
   expect(()=>imagePagesPdf([page])).toThrow('2 to 8');
   expect(()=>imagePagesPdf(Array.from({length:9},()=>page))).toThrow('2 to 8');
   expect(()=>imagePagesPdf([page,{...page,width:9}])).toThrow();
   expect(()=>imagePagesPdf([page,{...page,jpeg:jpeg.subarray(0,-1)}])).toThrow();
   const metadata=Buffer.concat([jpeg.subarray(0,2),Buffer.from([255,225,0,4,65,66]),jpeg.subarray(2)]);
   expect(()=>imagePagesPdf([page,{...page,jpeg:metadata}])).toThrow();
 });
 it('refuses aggregate JPEG budget before constructing PDF bytes',()=>{
   const fake=new Uint8Array(33*1024*1024);
   expect(()=>imagePagesPdf([{jpeg:fake,width:8,height:4},{jpeg,width:8,height:4}])).toThrow('Too much PDF');
 });
});
