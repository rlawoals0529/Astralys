import { imagePagesPdf } from '../core/pdf';

export interface PdfComposeJob {
  pages: Array<{blob:Blob;width:number;height:number}>;
}
export interface PdfComposeResult {blob:Blob;pages:number;size:number;}

const progress=(stage:string)=>self.postMessage({kind:'progress',stage});
self.onmessage=async(event:MessageEvent<PdfComposeJob>)=>{
  try {
    const pages=event.data?.pages;
    if(!Array.isArray(pages)||pages.length<2||pages.length>8)throw new Error('Choose 2 to 8 image pages.');
    let total=0;
    const verified:{jpeg:Uint8Array;width:number;height:number}[]=[];
    for(const [index,page] of pages.entries()){
      if(!(page.blob instanceof Blob)||page.blob.type!=='image/jpeg')throw new Error('Only locally re-encoded JPEG page data is accepted.');
      total+=page.blob.size;
      if(total>32*1024*1024)throw new Error('PDF page images exceed the 32 MiB budget. Reduce image size.');
      progress('Composing page '+(index+1)+' of '+pages.length+'…');
      verified.push({jpeg:new Uint8Array(await page.blob.arrayBuffer()),width:page.width,height:page.height});
    }
    const bytes=imagePagesPdf(verified);
    const blob=new Blob([bytes],{type:'application/pdf'});
    self.postMessage({kind:'done',result:{blob,pages:pages.length,size:blob.size} satisfies PdfComposeResult});
  }catch(error){self.postMessage({kind:'error',error:error instanceof Error?error.message:'Unable to compose image pages.'});}
};
