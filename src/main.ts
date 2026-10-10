import './style.css';
import { checkDimensions, checkSize, safeName, suggestedActions } from './core/files';
import type { ImageInfo, ImageMime } from './core/files';
import { JobRunner, ObjectUrlSlot } from './core/jobs';
import { classifyMediaLink } from './core/media';
import { PhotoHistory, isFramePreset } from './core/photo';
import type { ImageJob, ImageResult } from './workers/image.worker';
function el<T extends HTMLElement = HTMLElement>(id: string): T { const node=document.getElementById(id); if(!node)throw new Error(`Missing element ${id}`);return node as T; }
const runner=new JobRunner(()=>new Worker(new URL('./workers/image.worker.ts',import.meta.url),{type:'module'}));
const previewUrl=new ObjectUrlSlot(), outputUrl=new ObjectUrlSlot(), history=new PhotoHistory();
let rollback: (()=>void) | undefined;
let file: File | undefined, info: ImageInfo | undefined, requestId=0, busy=false, photoOpen=false, ratio=1;
const status=(message:string,error=false)=> {el('status').textContent=message;el('status-row').classList.toggle('error',error);};
const input=(id:string)=>el<HTMLInputElement>(id);
function clearOutput() {outputUrl.clear();el('result').hidden=true;el('download').removeAttribute('href');}
function setBusy(value:boolean) {busy=value;el('cancel').hidden=!value;el('progress').hidden=!value;el('workspace').setAttribute('aria-busy',String(value));for(const field of document.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLButtonElement>('#export-form input, #export-form select, #suggestions button'))field.disabled=value;for(const id of ['export','pdf-export','rotate','flip','reset','sample','frame-apply']) el<HTMLButtonElement>(id).disabled=value;el<HTMLSelectElement>('frame-select').disabled=value;el<HTMLButtonElement>('undo').disabled=value||!history.canUndo;}
function settings(mode:'inspect'|'export'|'pdf'): ImageJob {
  if(!file) throw new Error('Choose an image first.');
  const width=Number(input('width').value),height=Number(input('height').value);
  if(mode!=='inspect')checkDimensions(width,height);
  return {file,mode,mime:el<HTMLSelectElement>('format').value as ImageMime,width:mode!=='inspect'?width:undefined,height:mode!=='inspect'?height:undefined,quality:Number(input('quality').value)/100,photo:history.current};
}
async function process(mode:'inspect'|'export'|'pdf') {
  const id=++requestId; runner.cancel(); clearOutput();setBusy(true);
  try {
    const result=await runner.run<ImageResult>(settings(mode),s=> {if(id===requestId)status(s);});
    if(id!==requestId)return;
    info=result.info;
    if(mode!=='pdf')el<HTMLImageElement>('preview').src=previewUrl.set(result.blob);
    if(mode==='inspect') {
      input('width').value=String(result.width);input('height').value=String(result.height);ratio=result.width/result.height;
      rollback=undefined;renderFile();status('Image ready. Choose an action or adjust your export.');
    } else {
      const link=el<HTMLAnchorElement>('download');link.href=outputUrl.set(result.blob);link.download=safeName(file!.name,result.blob.type as ImageMime|'application/pdf');
      el('result-info').textContent=`${result.width} × ${result.height} · ${formatBytes(result.blob.size)} · ${result.blob.type.split('/')[1].toUpperCase()}. Original file unchanged.`;
      el('result-title').textContent=mode==='pdf'?'Your PDF is ready.':'Your image is ready.';link.textContent=mode==='pdf'?'Download PDF ↓':'Download image ↓';el('result').hidden=false;status(mode==='pdf'?'Your single-page PDF is ready to download.':'Your image is ready to download.');link.focus();
    }
  } catch(error) {if(id!==requestId)return;rollback?.();rollback=undefined;el<HTMLSelectElement>('frame-select').value=history.current.frame;status(error instanceof Error?error.message:'Unable to process this image.',!(error instanceof DOMException && error.name==='AbortError'));}
  finally {if(id===requestId)setBusy(false);}
}
function formatBytes(n:number) {return n<1024*1024?`${(n/1024).toFixed(1)} KiB`:`${(n/1024/1024).toFixed(2)} MiB`;}
function renderFile() {
  if(!file||!info)return;
  document.body.classList.add('has-file');el('workspace').hidden=false;el('principles').hidden=true;el('file-name').textContent=file.name;
  el('file-details').textContent=`${info.mime.split('/')[1].toUpperCase()} · ${info.width} × ${info.height} · ${formatBytes(file.size)}`;
  el('file-warning').hidden=!info.warning;el('file-warning').textContent=info.warning;
  const metadata=el('metadata');metadata.replaceChildren();
  for(const [key,value] of Object.entries({'Detected type':info.mime,'Source size':formatBytes(file.size),'Source pixels':`${info.width} × ${info.height}`,'Metadata containers':info.metadata.join(', ')||'None identified'})) {const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;metadata.append(dt,dd);}
  const list=el('suggestions');list.replaceChildren();
  for(const action of suggestedActions(info.mime)) {const b=document.createElement('button');b.textContent=action;b.type='button';b.onclick=()=> {
    if(busy)return;
    if(action==='Open in Photo'){showPhoto();return;}
    if(action==='Convert to PDF'){void process('pdf');return;}
    if(action==='Resize'){input('width').focus();return;}
    el<HTMLSelectElement>('format').value=action==='Remove metadata'?info!.mime:action==='Convert to PNG'?'image/png':'image/webp';updateFormat();void process('export');
  };list.append(b);}
  el('photo-tools').hidden=!photoOpen;el<HTMLSelectElement>('frame-select').value=history.current.frame;updateFormat();
}
async function chooseFile(next: File) {
  clearSession(false);file=next;
  try {checkSize(next.size);}catch(e){status((e as Error).message,true);file=undefined;return;}
  status('Opening image…');await process('inspect');
}
function clearSession(announce=true) {
  document.body.classList.remove('has-file');++requestId;runner.cancel();rollback=undefined;setBusy(false);file=undefined;info=undefined;history.reset();el<HTMLSelectElement>('frame-select').value='original';previewUrl.clear();clearOutput();el<HTMLImageElement>('preview').removeAttribute('src');el('workspace').hidden=true;el('principles').hidden=false;input('file-input').value='';if(announce)status('File cleared. Choose another image.');
}
function updateFormat() {
  const format=el<HTMLSelectElement>('format').value;el('quality-row').hidden=format==='image/png';
  el('format-help').textContent=format==='image/jpeg'?'JPEG replaces transparent areas with white. Re-encoding can change color and detail.':format==='image/png'?'PNG keeps transparency. Lossless output can be larger than the original.':'WebP keeps transparency. Smaller output is not guaranteed.';
}
function showPhoto() {photoOpen=true;el('photo-tools').hidden=false;status('Photo adjustments are non-destructive. Export when you are ready.');el('rotate').focus();}
el('choose-file').onclick=()=>input('file-input').click();
input('file-input').onchange=()=> {const next=input('file-input').files?.[0];if(next)void chooseFile(next);};
const drop=el('dropzone');
drop.ondragover=e=>{e.preventDefault();drop.classList.add('dragging');};drop.ondragleave=()=>drop.classList.remove('dragging');
drop.ondrop=e=>{e.preventDefault();drop.classList.remove('dragging');const files=e.dataTransfer?.files;if(files?.length!==1){status('Choose one image at a time.',true);return;}void chooseFile(files[0]);};
// Prevent accidental file navigation when a drop misses the target.
window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>e.preventDefault());
el('cancel').onclick=()=>{++requestId;runner.cancel();rollback?.();rollback=undefined;el<HTMLSelectElement>('frame-select').value=history.current.frame;setBusy(false);status('Cancelled. Your original file is unchanged.');};
el('clear').onclick=()=>{clearSession();el('choose-file').focus();};
el('export-form').onsubmit=e=>{e.preventDefault();if(!busy)void process('export');};
el('pdf-export').onclick=()=>{if(!busy)void process('pdf');};
el('format').onchange=()=>{clearOutput();updateFormat();};
input('quality').oninput=()=>{el('quality-value').textContent=input('quality').value;clearOutput();};
for(const [changed,other] of [['width','height'],['height','width']])input(changed).oninput=()=> {clearOutput();if(input('aspect').checked){const n=Number(input(changed).value);if(Number.isFinite(n)&&n>0)input(other).value=String(Math.max(1,Math.round(changed==='width'?n/ratio:n*ratio)));}};
for(const [id,action] of [['rotate',()=>history.rotate()],['flip',()=>history.flip()],['undo',()=>history.undo()],['reset',()=>history.reset()]] as const)el(id).onclick=()=>{if(busy)return;const checkpoint=history.checkpoint();rollback=()=>history.restore(checkpoint);action();void process('inspect');};
el('frame-apply').onclick=()=>{if(busy||!file)return;const preset=el<HTMLSelectElement>('frame-select').value;if(!isFramePreset(preset)){status('Choose a supported crop format.',true);return;}if(preset===history.current.frame){status('This framing is already applied.');return;}const checkpoint=history.checkpoint();rollback=()=>history.restore(checkpoint);history.setFrame(preset);void process('inspect');};
function inputTab(link:boolean) {el('file-entry').hidden=link;el('link-entry').hidden=!link;for(const [id,active] of [['link-tab',link],['file-tab',!link]] as const){el(id).classList.toggle('selected',active);el(id).setAttribute('aria-pressed',String(active));}if(link)input('media-url').focus();}
el('file-tab').onclick=()=>inputTab(false);el('link-tab').onclick=()=>inputTab(true);
el('link-entry').onsubmit=e=>{e.preventDefault();const result=el('link-result');result.replaceChildren();result.hidden=false;try{const c=classifyMediaLink(input('media-url').value);const heading=document.createElement('h2'),body=document.createElement('p');heading.textContent=c.title;body.textContent=c.message;result.append(heading,body);}catch(error){result.textContent=(error as Error).message;}};
el('privacy-button').onclick=()=>{el('privacy-panel').hidden=!el('privacy-panel').hidden;};el('close-privacy').onclick=()=>{el('privacy-panel').hidden=true;el('privacy-button').focus();};
const categories: Record<string,[string,string]>={images:['Image tools, ready here.','Convert, resize, remove metadata, or make simple Photo adjustments. PNG, JPEG and WebP stay on your device.'],video:['Video is on the roadmap.','Transcoding, trimming and audio extraction are not available in this build. No video file is opened or uploaded.'],audio:['Audio is on the roadmap.','Local audio conversion will follow codec and distribution review. No audio processor is loaded.'],pdf:['One image, one PDF.','Choose a PNG, JPEG or WebP image, then create a single-page PDF locally. JPEG compression and a white background are used. This build does not open, render, merge or modify existing PDFs.'],documents:['Documents are on the roadmap.','Office document conversion is not supported yet. Files are never uploaded as a fallback.'],archives:['Archive tools are on the roadmap.','Extraction will require path, file-count and expanded-size protections. No archive extraction is available now.'],data:['Data tools are on the roadmap.','CSV and JSON inspection and conversion are planned. No data parsing is available in this build.'],creative:['Photo studio · a small beginning.','Open an image for rotation, flipping and non-destructive reset. Layers, drawing, PSD and other editors are future work.']};
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-category]')) button.onclick=()=> {
  for(const b of document.querySelectorAll('[data-category]')){b.classList.remove('active');b.removeAttribute('aria-current');}button.classList.add('active');button.setAttribute('aria-current','page');
  const c=button.dataset.category!;const detail=categories[c];el('category-panel').hidden=!detail;
  if(detail){el('category-title').textContent=detail[0];el('category-copy').textContent=detail[1];}
  photoOpen=c==='creative';el('photo-tools').hidden=!photoOpen;inputTab(false);if(photoOpen&&info)showPhoto();
};
el('sample').onclick=async()=> {
  const canvas=document.createElement('canvas');canvas.width=960;canvas.height=640;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#d9cfe3';ctx.fillRect(0,0,960,640);ctx.fillStyle='#f2e5bd';ctx.beginPath();ctx.arc(670,210,115,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#9d91b2';ctx.beginPath();ctx.moveTo(0,540);ctx.quadraticCurveTo(280,40,660,640);ctx.lineTo(0,640);ctx.fill();
  ctx.fillStyle='#5d5777';ctx.beginPath();ctx.moveTo(280,640);ctx.quadraticCurveTo(710,220,960,370);ctx.lineTo(960,640);ctx.fill();
  ctx.fillStyle='#f5edd9';ctx.font='28px Georgia';ctx.fillText('a small shift in perspective',50,70);
  canvas.toBlob(blob=>{if(blob)void chooseFile(new File([blob],'astralys-sample.png',{type:'image/png'}));},'image/png');
};
window.addEventListener('pagehide',()=>{++requestId;runner.cancel();previewUrl.clear();clearOutput();file=undefined;info=undefined;});
window.addEventListener('pageshow',e=>{if(e.persisted)clearSession();});
updateFormat();
document.documentElement.dataset.appReady='true';
