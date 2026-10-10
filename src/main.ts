import './style.css';
import { checkDimensions, checkSize, safeName, suggestedActions } from './core/files';
import type { ImageInfo, ImageMime } from './core/files';
import { JobRunner, ObjectUrlSlot } from './core/jobs';
import { classifyMediaLink } from './core/media';
import { PhotoHistory, frameBounds, isFramePreset } from './core/photo';
import type { ImageJob, ImageResult } from './workers/image.worker';
function el<T extends HTMLElement = HTMLElement>(id: string): T { const node=document.getElementById(id); if(!node)throw new Error(`Missing element ${id}`);return node as T; }
const runner=new JobRunner(()=>new Worker(new URL('./workers/image.worker.ts',import.meta.url),{type:'module'}));
const previewUrl=new ObjectUrlSlot(), originalPreviewUrl=new ObjectUrlSlot(), outputUrl=new ObjectUrlSlot(), history=new PhotoHistory();
let rollback: (()=>void) | undefined;
let file: File | undefined, info: ImageInfo | undefined, requestId=0, busy=false, photoOpen=false, compareMode=false, ratio=1;
let cropDrag: {pointerId:number; x:number; y:number; width:number; height:number; cropX:number; cropY:number} | undefined;
const status=(message:string,error=false)=> {el('status').textContent=message;el('status-row').classList.toggle('error',error);};
const input=(id:string)=>el<HTMLInputElement>(id);
function syncComparison() {
  const ready=Boolean(file&&info&&originalPreviewUrl.value&&previewUrl.value);
  const active=ready&&photoOpen&&compareMode;
  const button=el<HTMLButtonElement>('compare');
  button.disabled=!ready||busy;
  button.setAttribute('aria-pressed',String(active));
  button.textContent=active?'Close comparison':'Compare original';
  el('comparison-original').hidden=!active;
  const stage=el('preview-stage');
  stage.classList.toggle('compare-mode',active);
  stage.setAttribute('aria-label',active?'Original and edited image comparison':'Edited image preview');
  el('preview-label').textContent=active?'AFTER · EDITED':'LOCAL PREVIEW';
}
const percent=(n:number)=>Math.max(0,Math.min(100,Math.round(n)));
function syncCropControls() {
  const state=history.current;
  const active=Boolean(photoOpen&&file&&info&&state.frame!=='original');
  el('crop-position').hidden=!active;
  const w=info ? (state.turns%2 ? info.height : info.width) : 1;
  const h=info ? (state.turns%2 ? info.width : info.height) : 1;
  const area=frameBounds(w,h,state.frame,state.cropX,state.cropY);
  for(const [axis,n,available] of [['crop-x',state.cropX,w-area.width],['crop-y',state.cropY,h-area.height]] as const) {
    const slider=input(axis);slider.value=String(n);slider.disabled=!active||busy||available===0;
    el(axis+'-value').textContent=n+'%';
  }
  el<HTMLButtonElement>('crop-center').disabled=!active||busy||(state.cropX===50&&state.cropY===50);
  el('preview').classList.toggle('crop-can-drag',active&&!busy&&(w>area.width||h>area.height));
  el('preview').setAttribute('aria-describedby',active?'crop-help':'');
}
function applyCropPosition(x:number,y:number) {
  if(!file||busy||history.current.frame==='original')return;
  const cropX=percent(x),cropY=percent(y),state=history.current;
  if(cropX===state.cropX&&cropY===state.cropY){syncCropControls();return;}
  const checkpoint=history.checkpoint();rollback=()=>history.restore(checkpoint);
  history.setPosition(cropX,cropY);void process('inspect');
}
function clearOutput() {outputUrl.clear();el('result').hidden=true;el('download').removeAttribute('href');}
function setBusy(value:boolean) {busy=value;el('cancel').hidden=!value;el('progress').hidden=!value;el('workspace').setAttribute('aria-busy',String(value));for(const field of document.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLButtonElement>('#export-form input, #export-form select, #suggestions button'))field.disabled=value;for(const id of ['export','pdf-export','rotate','flip','reset','sample','frame-apply']) el<HTMLButtonElement>(id).disabled=value;el<HTMLSelectElement>('frame-select').disabled=value;el<HTMLButtonElement>('undo').disabled=value||!history.canUndo;syncCropControls();syncComparison();}
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
    if(mode!=='pdf') {
      el<HTMLImageElement>('preview').src=previewUrl.set(result.blob);
      // Retain only a sanitized, bounded first preview; never create a URL for the raw File.
      if(mode==='inspect'&&!originalPreviewUrl.value) {
        el<HTMLImageElement>('original-preview').src=originalPreviewUrl.set(result.blob);
      }
    }
    if(mode==='inspect') {
      input('width').value=String(result.width);input('height').value=String(result.height);ratio=result.width/result.height;
      rollback=undefined;renderFile();status('Image ready. Choose an action or adjust your export.');
    } else {
      const link=el<HTMLAnchorElement>('download');link.href=outputUrl.set(result.blob);link.download=safeName(file!.name,result.blob.type as ImageMime|'application/pdf');
      el('result-info').textContent=`${result.width} × ${result.height} · ${formatBytes(result.blob.size)} · ${result.blob.type.split('/')[1].toUpperCase()}. Original file unchanged.`;
      el('result-title').textContent=mode==='pdf'?'Your PDF is ready.':'Your image is ready.';link.textContent=mode==='pdf'?'Download PDF ↓':'Download image ↓';el('result').hidden=false;status(mode==='pdf'?'Your single-page PDF is ready to download.':'Your image is ready to download.');link.focus();
    }
  } catch(error) {if(id!==requestId)return;rollback?.();rollback=undefined;el<HTMLSelectElement>('frame-select').value=history.current.frame;syncCropControls();status(error instanceof Error?error.message:'Unable to process this image.',!(error instanceof DOMException && error.name==='AbortError'));}
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
  el('photo-tools').hidden=!photoOpen;el<HTMLSelectElement>('frame-select').value=history.current.frame;syncCropControls();syncComparison();updateFormat();
}
async function chooseFile(next: File) {
  clearSession(false);file=next;
  try {checkSize(next.size);}catch(e){status((e as Error).message,true);file=undefined;return;}
  status('Opening image…');await process('inspect');
}
function clearSession(announce=true) {
  document.body.classList.remove('has-file');++requestId;runner.cancel();cropDrag=undefined;rollback=undefined;setBusy(false);file=undefined;info=undefined;compareMode=false;history.reset();el<HTMLSelectElement>('frame-select').value='original';previewUrl.clear();originalPreviewUrl.clear();clearOutput();el<HTMLImageElement>('preview').removeAttribute('src');el<HTMLImageElement>('original-preview').removeAttribute('src');el('workspace').hidden=true;el('principles').hidden=false;input('file-input').value='';syncCropControls();syncComparison();if(announce)status('File cleared. Choose another image.');
}
function updateFormat() {
  const format=el<HTMLSelectElement>('format').value;el('quality-row').hidden=format==='image/png';
  el('format-help').textContent=format==='image/jpeg'?'JPEG replaces transparent areas with white. Re-encoding can change color and detail.':format==='image/png'?'PNG keeps transparency. Lossless output can be larger than the original.':'WebP keeps transparency. Smaller output is not guaranteed.';
}
function showPhoto() {photoOpen=true;el('photo-tools').hidden=false;syncCropControls();syncComparison();status('Photo adjustments are non-destructive. Export when you are ready.');el('rotate').focus();}
el('choose-file').onclick=()=>input('file-input').click();
input('file-input').onchange=()=> {const next=input('file-input').files?.[0];if(next)void chooseFile(next);};
const drop=el('dropzone');
drop.ondragover=e=>{e.preventDefault();drop.classList.add('dragging');};drop.ondragleave=()=>drop.classList.remove('dragging');
drop.ondrop=e=>{e.preventDefault();drop.classList.remove('dragging');const files=e.dataTransfer?.files;if(files?.length!==1){status('Choose one image at a time.',true);return;}void chooseFile(files[0]);};
// Prevent accidental file navigation when a drop misses the target.
window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>e.preventDefault());
el('cancel').onclick=()=>{++requestId;runner.cancel();rollback?.();rollback=undefined;el<HTMLSelectElement>('frame-select').value=history.current.frame;setBusy(false);syncCropControls();status('Cancelled. Your original file is unchanged.');};
el('clear').onclick=()=>{clearSession();el('choose-file').focus();};
el('export-form').onsubmit=e=>{e.preventDefault();if(!busy)void process('export');};
el('pdf-export').onclick=()=>{if(!busy)void process('pdf');};
el('format').onchange=()=>{clearOutput();updateFormat();};
input('quality').oninput=()=>{el('quality-value').textContent=input('quality').value;clearOutput();};
for(const [changed,other] of [['width','height'],['height','width']])input(changed).oninput=()=> {clearOutput();if(input('aspect').checked){const n=Number(input(changed).value);if(Number.isFinite(n)&&n>0)input(other).value=String(Math.max(1,Math.round(changed==='width'?n/ratio:n*ratio)));}};
for(const [id,action] of [['rotate',()=>history.rotate()],['flip',()=>history.flip()],['undo',()=>history.undo()],['reset',()=>history.reset()]] as const)el(id).onclick=()=>{if(busy)return;const checkpoint=history.checkpoint();rollback=()=>history.restore(checkpoint);action();void process('inspect');};
el('frame-apply').onclick=()=>{if(busy||!file)return;const preset=el<HTMLSelectElement>('frame-select').value;if(!isFramePreset(preset)){status('Choose a supported crop format.',true);return;}if(preset===history.current.frame){status('This framing is already applied.');return;}const checkpoint=history.checkpoint();rollback=()=>history.restore(checkpoint);history.setFrame(preset);void process('inspect');};
for(const axis of ['crop-x','crop-y'] as const) {
  input(axis).oninput=()=>{el(axis+'-value').textContent=input(axis).value+'%';};
  input(axis).onchange=()=>{
    if(busy)return;
    applyCropPosition(Number(input('crop-x').value),Number(input('crop-y').value));
  };
}
el('crop-center').onclick=()=>applyCropPosition(50,50);
el('compare').onclick=()=> {
  if(busy||!file||!info||!originalPreviewUrl.value)return;
  compareMode=!compareMode;syncComparison();
  status(compareMode?'Comparing the original framing with your current edit. Both previews stay on this device.':'Showing only the current edit.');
};
const previewImage=el<HTMLImageElement>('preview');
previewImage.draggable=false;
previewImage.onpointerdown=e=>{
  if(!info||busy||!photoOpen||history.current.frame==='original'||e.button!==0)return;
  const width=history.current.turns%2 ? info.height : info.width;
  const height=history.current.turns%2 ? info.width : info.height;
  const area=frameBounds(width,height,history.current.frame,history.current.cropX,history.current.cropY);
  if(width===area.width&&height===area.height)return;
  const rect=previewImage.getBoundingClientRect();
  if(rect.width===0||rect.height===0)return;
  cropDrag={pointerId:e.pointerId,x:e.clientX,y:e.clientY,width:rect.width,height:rect.height,cropX:history.current.cropX,cropY:history.current.cropY};
  previewImage.setPointerCapture(e.pointerId);previewImage.classList.add('crop-dragging');
  e.preventDefault();
};
function endCropDrag(e:PointerEvent,commit:boolean) {
  if(!cropDrag||cropDrag.pointerId!==e.pointerId)return;
  const start=cropDrag;cropDrag=undefined;
  previewImage.classList.remove('crop-dragging');
  if(previewImage.hasPointerCapture(e.pointerId))previewImage.releasePointerCapture(e.pointerId);
  if(!commit||busy||!info||!file)return;
  const width=history.current.turns%2 ? info.height : info.width;
  const height=history.current.turns%2 ? info.width : info.height;
  const area=frameBounds(width,height,history.current.frame);
  const dx=e.clientX-start.x,dy=e.clientY-start.y;
  if(Math.hypot(dx,dy)<4)return;
  const x=width===area.width?start.cropX:start.cropX-100*dx*area.width/((width-area.width)*start.width);
  const y=height===area.height?start.cropY:start.cropY-100*dy*area.height/((height-area.height)*start.height);
  applyCropPosition(x,y);
}
previewImage.onpointerup=e=>endCropDrag(e,true);
previewImage.onpointercancel=e=>endCropDrag(e,false);
function inputTab(link:boolean) {el('file-entry').hidden=link;el('link-entry').hidden=!link;for(const [id,active] of [['link-tab',link],['file-tab',!link]] as const){el(id).classList.toggle('selected',active);el(id).setAttribute('aria-pressed',String(active));}if(link)input('media-url').focus();}
el('file-tab').onclick=()=>inputTab(false);el('link-tab').onclick=()=>inputTab(true);
el('link-entry').onsubmit=e=>{e.preventDefault();const result=el('link-result');result.replaceChildren();result.hidden=false;try{const c=classifyMediaLink(input('media-url').value);const heading=document.createElement('h2'),body=document.createElement('p');heading.textContent=c.title;body.textContent=c.message;result.append(heading,body);}catch(error){result.textContent=(error as Error).message;}};
el('privacy-button').onclick=()=>{el('privacy-panel').hidden=!el('privacy-panel').hidden;};el('close-privacy').onclick=()=>{el('privacy-panel').hidden=true;el('privacy-button').focus();};
const categories: Record<string,[string,string]>={images:['Image tools, ready here.','Convert, resize, remove metadata, or make simple Photo adjustments. PNG, JPEG and WebP stay on your device.'],video:['Video is on the roadmap.','Transcoding, trimming and audio extraction are not available in this build. No video file is opened or uploaded.'],audio:['Audio is on the roadmap.','Local audio conversion will follow codec and distribution review. No audio processor is loaded.'],pdf:['One image, one PDF.','Choose a PNG, JPEG or WebP image, then create a single-page PDF locally. JPEG compression and a white background are used. This build does not open, render, merge or modify existing PDFs.'],documents:['Documents are on the roadmap.','Office document conversion is not supported yet. Files are never uploaded as a fallback.'],archives:['Archive tools are on the roadmap.','Extraction will require path, file-count and expanded-size protections. No archive extraction is available now.'],data:['Data tools are on the roadmap.','CSV and JSON inspection and conversion are planned. No data parsing is available in this build.'],creative:['Photo studio · a small beginning.','Crop and reposition an image, rotate, flip, compare with the original and export locally. Layers, drawing and PSD editing are future work.']};
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-category]')) button.onclick=()=> {
  for(const b of document.querySelectorAll('[data-category]')){b.classList.remove('active');b.removeAttribute('aria-current');}button.classList.add('active');button.setAttribute('aria-current','page');
  const c=button.dataset.category!;const detail=categories[c];el('category-panel').hidden=!detail;
  if(detail){el('category-title').textContent=detail[0];el('category-copy').textContent=detail[1];}
  photoOpen=c==='creative';el('photo-tools').hidden=!photoOpen;syncCropControls();syncComparison();inputTab(false);if(photoOpen&&info)showPhoto();
};
el('sample').onclick=async()=> {
  const canvas=document.createElement('canvas');canvas.width=960;canvas.height=640;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#d9cfe3';ctx.fillRect(0,0,960,640);ctx.fillStyle='#f2e5bd';ctx.beginPath();ctx.arc(670,210,115,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#9d91b2';ctx.beginPath();ctx.moveTo(0,540);ctx.quadraticCurveTo(280,40,660,640);ctx.lineTo(0,640);ctx.fill();
  ctx.fillStyle='#5d5777';ctx.beginPath();ctx.moveTo(280,640);ctx.quadraticCurveTo(710,220,960,370);ctx.lineTo(960,640);ctx.fill();
  ctx.fillStyle='#f5edd9';ctx.font='28px Georgia';ctx.fillText('a small shift in perspective',50,70);
  canvas.toBlob(blob=>{if(blob)void chooseFile(new File([blob],'astralys-sample.png',{type:'image/png'}));},'image/png');
};
window.addEventListener('pagehide',()=>{++requestId;runner.cancel();previewUrl.clear();originalPreviewUrl.clear();clearOutput();file=undefined;info=undefined;});
window.addEventListener('pageshow',e=>{if(e.persisted)clearSession();});
updateFormat();
document.documentElement.dataset.appReady='true';
