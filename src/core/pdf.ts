import { checkDimensions } from './files';
const MAX_OUTPUT = 64 * 1024 * 1024;
const ascii = (s: string) => new TextEncoder().encode(s);

// Internal writer for freshly encoded, metadata-stripped browser JPEG only.
// Never pass through a user's original JPEG or parse an existing PDF here.
export function imagePdf(jpeg: Uint8Array, width: number, height: number): Uint8Array<ArrayBuffer> {
  checkDimensions(width, height);
  if (jpeg.length > MAX_OUTPUT - 4096) throw new Error('The PDF output is too large. Reduce dimensions.');
  const invalid = () => { throw new Error('The browser JPEG cannot be placed in a PDF. Try another image.'); };
  if (jpeg.length < 4 || jpeg[0] !== 255 || jpeg[1] !== 216 || jpeg.at(-2) !== 255 || jpeg.at(-1) !== 217) invalid();
  let offset = 2, frames = 0, scan = false, segments = 0;
  while (offset < jpeg.length - 2) {
    if (++segments > 4096 || jpeg[offset++] !== 255) invalid();
    while (jpeg[offset] === 255) offset++;
    const marker = jpeg[offset++];
    if (offset + 2 > jpeg.length) invalid();
    const length = jpeg[offset] * 256 + jpeg[offset + 1];
    if (length < 2 || offset + length > jpeg.length - 2) invalid();
    if ((marker >= 0xe1 && marker <= 0xef) || marker === 0xfe) invalid();
    if (marker === 0xc0) {
      frames++;
      if (length !== 17 || jpeg[offset + 2] !== 8 || jpeg[offset + 7] !== 3 ||
          jpeg[offset + 3] * 256 + jpeg[offset + 4] !== height ||
          jpeg[offset + 5] * 256 + jpeg[offset + 6] !== width) invalid();
    } else if (![0xe0, 0xdb, 0xc4, 0xdd, 0xda].includes(marker)) invalid();
    offset += length;
    if (marker === 0xda) { scan = true; break; }
  }
  if (frames !== 1 || !scan) invalid();
  const w = width * 0.75, h = height * 0.75;
  const content = ascii(`q\n${w} 0 0 ${h} 0 0 cm\n/Im0 Do\nQ\n`);
  const parts: Uint8Array[] = [ascii('%PDF-1.4\n'), new Uint8Array([37,226,227,207,211,10])];
  let size = parts.reduce((n,p)=>n+p.length,0);
  const offsets = [0];
  const append = (p: Uint8Array) => { parts.push(p); size += p.length; };
  const object = (id: number, body: Uint8Array[]) => {
    offsets.push(size); append(ascii(`${id} 0 obj\n`)); body.forEach(append); append(ascii('\nendobj\n'));
  };
  object(1,[ascii('<< /Type /Catalog /Pages 2 0 R >>')]);
  object(2,[ascii('<< /Type /Pages /Kids [3 0 R] /Count 1 >>')]);
  object(3,[ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`)]);
  object(4,[ascii(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),jpeg,ascii('\nendstream')]);
  object(5,[ascii(`<< /Length ${content.length} >>\nstream\n`),content,ascii('endstream')]);
  const xref = size;
  append(ascii(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  if (size > MAX_OUTPUT) throw new Error('The PDF output is too large.');
  const output = new Uint8Array(size); let cursor = 0;
  for (const part of parts) { output.set(part,cursor); cursor += part.length; }
  return output;
}
