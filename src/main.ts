import './style.css';
import { checkDimensions, checkSize, safeName, suggestedActions } from './core/files';
import type { ImageInfo, ImageMime } from './core/files';
import { JobRunner, ObjectUrlSlot } from './core/jobs';
import { classifyMediaLink } from './core/media';
import { isExportPreset, isLongEdge, presetSize } from './core/export-presets';
import type { LongEdge } from './core/export-presets';
import { PhotoHistory, blankPhotoState, frameBounds, isFramePreset, validRedaction } from './core/photo';
import type { RedactionRect, ToneAxis } from './core/photo';
import type { ImageJob, ImageResult } from './workers/image.worker';
function el<T extends HTMLElement = HTMLElement>(id: string): T { const node=document.getElementById(id); if(!node)throw new Error(`Missing element ${id}`);return node as T; }
const workerFactory=()=>new Worker(new URL('./workers/image.worker.ts',import.meta.url),{type:'module'});
const runner=new JobRunner(workerFactory),batchRunner=new JobRunner(workerFactory);
const previewUrl=new ObjectUrlSlot(), originalPreviewUrl=new ObjectUrlSlot(), outputUrl=new ObjectUrlSlot(), history=new PhotoHistory();
let rollback: (()=>void) | undefined;
let file: File | undefined, info: ImageInfo | undefined, requestId=0, busy=false, photoOpen=false, compareMode=false, ratio=1, naturalWidth=0, naturalHeight=0;
let cropDrag: {pointerId:number; x:number; y:number; width:number; height:number; cropX:number; cropY:number} | undefined;
let redactArmed=false,redactDrag:{pointerId:number;x:number;y:number}|undefined;
let batchFiles:File[]=[],batchBusy=false,batchSerial=0;
let batchStoredBytes=0;
const batchUrls:ObjectUrlSlot[]=[];
const status=(message:string,error=false)=> {el('status').textContent=message;el('status-row').classList.toggle('error',error);};
const input=(id:string)=>el<HTMLInputElement>(id);
function syncSizePreset() {
  const value=el<HTMLSelectElement>('size-preset').value;
  const help=el('size-preset-help');
  if(!naturalWidth||!naturalHeight){help.textContent='Presets preserve aspect ratio and never upscale. Choose an image to begin.';return;}
  if(value==='custom') {
    help.textContent='Custom dimensions. Editing the source crop or orientation resets manual dimensions; export validates pixel limits.';
    return;
  }
  if(!isExportPreset(value)){help.textContent='Unsupported size preset.';return;}
  const size=presetSize(naturalWidth,naturalHeight,value);
  input('width').value=String(size.width);input('height').value=String(size.height);
  input('aspect').checked=true;
  help.textContent='Output '+size.width+' × '+size.height+' px. '+(size.width===naturalWidth&&size.height===naturalHeight?'No upscaling; source is already within the limit.':'Fits inside the chosen longest-edge limit, without cropping or upscaling.');
}
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
function syncPhotoControls() {
  const editing=!!file&&!!info&&photoOpen;
  for(const axis of ['brightness','contrast','saturation'] as const) {
    const id='tone-'+axis;
    input(id).value=String(history.current[axis]);
    input(id).disabled=busy||!editing;
    el(id+'-value').textContent=String(history.current[axis]);
  }
  el<HTMLButtonElement>('tone-reset').disabled=busy||!editing||!(['brightness','contrast','saturation'] as const).some(axis=>history.current[axis]);
  for(const id of ['redact-x','redact-y','redact-width','redact-height'])input(id).disabled=busy||!editing;
  el<HTMLButtonElement>('redact-apply').disabled=busy||!editing||history.current.redactions.length>=10;
  el<HTMLButtonElement>('redact-draw').disabled=busy||!editing||history.current.redactions.length>=10;
  el<HTMLButtonElement>('redact-draw').setAttribute('aria-pressed',String(redactArmed&&editing));
  el('redact-count').textContent=history.current.redactions.length+' / 10 regions. Undo to remove the last edit.';
  el('preview').classList.toggle('redact-armed',editing&&!busy&&redactArmed);
}
function editPhoto(action:()=>void) {
  if(!file||busy)return;
  if(batchBusy){status('Finish or cancel the batch before editing a photo.',true);return;}
  const snapshot=history.checkpoint();
  try {action();}catch(e){status(e instanceof Error?e.message:'Invalid Photo edit.',true);return;}
  if(history.checkpoint().length===snapshot.length){syncPhotoControls();return;}
  rollback=()=>history.restore(snapshot);void process('inspect');
}
function addRedaction(rect:RedactionRect) {
  if(!validRedaction(rect)){status('Redaction must be a whole-percent rectangle fully inside the image.',true);return;}
  editPhoto(()=>history.addRedaction(rect));
}
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
  editPhoto(()=>history.setPosition(cropX,cropY));
}
function clearOutput() {outputUrl.clear();el('result').hidden=true;el('download').removeAttribute('href');}
function setBusy(value:boolean) {busy=value;el('cancel').hidden=!value;el('progress').hidden=!value;el('workspace').setAttribute('aria-busy',String(value));for(const field of document.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLButtonElement>('#export-form input, #export-form select, #suggestions button'))field.disabled=value;for(const id of ['export','pdf-export','rotate','flip','reset','sample','frame-apply']) el<HTMLButtonElement>(id).disabled=value;el<HTMLSelectElement>('frame-select').disabled=value;el<HTMLButtonElement>('undo').disabled=value||!history.canUndo;syncCropControls();syncComparison();syncPhotoControls();}
function settings(mode:'inspect'|'export'|'pdf'): ImageJob {
  if(!file) throw new Error('Choose an image first.');
  const width=Number(input('width').value),height=Number(input('height').value);
  if(mode!=='inspect')checkDimensions(width,height);
  return {file,mode,mime:el<HTMLSelectElement>('format').value as ImageMime,width:mode!=='inspect'?width:undefined,height:mode!=='inspect'?height:undefined,quality:Number(input('quality').value)/100,photo:history.current};
}
async function process(mode:'inspect'|'export'|'pdf') {
  if(batchBusy){status('Cancel or finish the batch before editing an image.',true);return;}
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
      input('width').value=String(result.width);input('height').value=String(result.height);ratio=result.width/result.height;naturalWidth=result.width;naturalHeight=result.height;syncSizePreset();
      rollback=undefined;renderFile();status('Image ready. Choose an action or adjust your export.');
    } else {
      const link=el<HTMLAnchorElement>('download');link.href=outputUrl.set(result.blob);link.download=safeName(file!.name,result.blob.type as ImageMime|'application/pdf');
      el('result-info').textContent=`${result.width} × ${result.height} · ${formatBytes(result.blob.size)} · ${result.blob.type.split('/')[1].toUpperCase()}. Original file unchanged.`;
      el('result-title').textContent=mode==='pdf'?'Your PDF is ready.':'Your image is ready.';link.textContent=mode==='pdf'?'Download PDF ↓':'Download image ↓';el('result').hidden=false;status(mode==='pdf'?'Your single-page PDF is ready to download.':'Your image is ready to download.');link.focus();
    }
  } catch(error) {if(id!==requestId)return;rollback?.();rollback=undefined;el<HTMLSelectElement>('frame-select').value=history.current.frame;syncCropControls();syncPhotoControls();status(error instanceof Error?error.message:'Unable to process this image.',!(error instanceof DOMException && error.name==='AbortError'));}
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
  el('photo-tools').hidden=!photoOpen;el<HTMLSelectElement>('frame-select').value=history.current.frame;syncCropControls();syncComparison();syncPhotoControls();updateFormat();
}
async function chooseFile(next: File) {
  if(batchBusy){status('Finish or cancel the batch before opening another image.',true);return;}
  clearSession(false);file=next;
  try {checkSize(next.size);}catch(e){status((e as Error).message,true);file=undefined;return;}
  status('Opening image…');await process('inspect');
}
function clearSession(announce=true) {
  document.body.classList.remove('has-file');++requestId;runner.cancel();cropDrag=undefined;redactDrag=undefined;redactArmed=false;el('redact-outline').hidden=true;rollback=undefined;setBusy(false);file=undefined;info=undefined;compareMode=false;naturalWidth=0;naturalHeight=0;history.reset();el<HTMLSelectElement>('size-preset').value='original';syncSizePreset();el<HTMLSelectElement>('frame-select').value='original';previewUrl.clear();originalPreviewUrl.clear();clearOutput();el<HTMLImageElement>('preview').removeAttribute('src');el<HTMLImageElement>('original-preview').removeAttribute('src');el('workspace').hidden=true;el('principles').hidden=false;input('file-input').value='';syncCropControls();syncComparison();syncPhotoControls();if(announce)status('File cleared. Choose another image.');
}
function updateFormat() {
  const format=el<HTMLSelectElement>('format').value;el('quality-row').hidden=format==='image/png';
  el('format-help').textContent=format==='image/jpeg'?'JPEG replaces transparent areas with white. Re-encoding can change color and detail.':format==='image/png'?'PNG keeps transparency. Lossless output can be larger than the original.':'WebP keeps transparency. Smaller output is not guaranteed.';
}
function showPhoto() {photoOpen=true;el('photo-tools').hidden=false;syncCropControls();syncComparison();syncPhotoControls();status('Photo adjustments are non-destructive. Export when you are ready.');el('rotate').focus();}
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
el('size-preset').onchange=()=>{if(busy)return;clearOutput();syncSizePreset();};
input('aspect').onchange=()=>{if(!input('aspect').checked){el<HTMLSelectElement>('size-preset').value='custom';syncSizePreset();}clearOutput();};
input('quality').oninput=()=>{el('quality-value').textContent=input('quality').value;clearOutput();};
for(const [changed,other] of [['width','height'],['height','width']])input(changed).oninput=()=> {clearOutput();el<HTMLSelectElement>('size-preset').value='custom';syncSizePreset();if(input('aspect').checked){const n=Number(input(changed).value);if(Number.isFinite(n)&&n>0)input(other).value=String(Math.max(1,Math.round(changed==='width'?n/ratio:n*ratio)));}};
for(const [id,action] of [['rotate',()=>history.rotate()],['flip',()=>history.flip()],['undo',()=>history.undo()],['reset',()=>history.reset()]] as const)el(id).onclick=()=>editPhoto(action);
el('frame-apply').onclick=()=>{if(busy||!file)return;const preset=el<HTMLSelectElement>('frame-select').value;if(!isFramePreset(preset)){status('Choose a supported crop format.',true);return;}if(preset===history.current.frame){status('This framing is already applied.');return;}editPhoto(()=>history.setFrame(preset));};
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
for(const axis of ['brightness','contrast','saturation'] as const) {
  const id='tone-'+axis;
  input(id).oninput=()=>{el(id+'-value').textContent=input(id).value;};
  input(id).onchange=()=>editPhoto(()=>history.setTone(axis as ToneAxis,Number(input(id).value)));
}
el('tone-reset').onclick=()=>editPhoto(()=>history.resetTone());
el('redact-apply').onclick=()=>{
  const rect:RedactionRect={x:Number(input('redact-x').value),y:Number(input('redact-y').value),
    width:Number(input('redact-width').value),height:Number(input('redact-height').value)};
  addRedaction(rect);
};
el('redact-draw').onclick=()=>{
  if(busy||!file)return;
  redactArmed=!redactArmed;syncPhotoControls();
  if(redactArmed)previewImage.scrollIntoView({block:'center',behavior:'auto'});
  status(redactArmed?'Drag over the edited image to mark a permanent opaque black rectangle.':'Rectangle selection off.');
};
function updateRedactionOutline(x1:number,y1:number,x2:number,y2:number) {
  const stage=el('preview-stage').getBoundingClientRect(),outline=el<HTMLElement>('redact-outline');
  outline.hidden=false;outline.style.left=Math.min(x1,x2)-stage.x+'px';
  outline.style.top=Math.min(y1,y2)-stage.y+'px';
  outline.style.width=Math.abs(x2-x1)+'px';outline.style.height=Math.abs(y2-y1)+'px';
}
function finishRedactionDrag(event:PointerEvent,commit:boolean) {
  if(!redactDrag||redactDrag.pointerId!==event.pointerId)return false;
  const start=redactDrag;redactDrag=undefined;el('redact-outline').hidden=true;
  if(previewImage.hasPointerCapture(event.pointerId))previewImage.releasePointerCapture(event.pointerId);
  if(!commit||busy)return true;
  const rect=previewImage.getBoundingClientRect();
  const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
  const x1=clamp((start.x-rect.x)/rect.width,0,1),x2=clamp((event.clientX-rect.x)/rect.width,0,1);
  const y1=clamp((start.y-rect.y)/rect.height,0,1),y2=clamp((event.clientY-rect.y)/rect.height,0,1);
  if(Math.abs(x2-x1)*rect.width<4||Math.abs(y2-y1)*rect.height<4){status('Drag a larger rectangle, or use the four percentage fields.',true);return true;}
  const x=Math.floor(Math.min(x1,x2)*100),y=Math.floor(Math.min(y1,y2)*100);
  const r:RedactionRect={x,y,width:Math.max(1,Math.ceil(Math.max(x1,x2)*100)-x),height:Math.max(1,Math.ceil(Math.max(y1,y2)*100)-y)};
  r.width=Math.min(r.width,100-r.x);r.height=Math.min(r.height,100-r.y);
  redactArmed=false;syncPhotoControls();addRedaction(r);return true;
}

const previewImage=el<HTMLImageElement>('preview');
previewImage.draggable=false;
previewImage.onpointerdown=e=>{
  if(redactArmed&&info&&!busy&&photoOpen&&e.button===0){
    const rect=previewImage.getBoundingClientRect();
    redactDrag={pointerId:e.pointerId,x:e.clientX,y:e.clientY};
    previewImage.setPointerCapture(e.pointerId);
    const x=Math.max(rect.x,Math.min(rect.right,e.clientX)),y=Math.max(rect.y,Math.min(rect.bottom,e.clientY));
    updateRedactionOutline(x,y,x,y);e.preventDefault();return;
  }
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
previewImage.onpointermove=e=>{
  if(!redactDrag||redactDrag.pointerId!==e.pointerId)return;
  const rect=previewImage.getBoundingClientRect();
  updateRedactionOutline(redactDrag.x,redactDrag.y,Math.max(rect.left,Math.min(rect.right,e.clientX)),Math.max(rect.top,Math.min(rect.bottom,e.clientY)));
};
previewImage.onpointerup=e=>{if(!finishRedactionDrag(e,true))endCropDrag(e,true);};
previewImage.onpointercancel=e=>{if(!finishRedactionDrag(e,false))endCropDrag(e,false);};
function inputTab(link:boolean) {el('file-entry').hidden=link;el('link-entry').hidden=!link;for(const [id,active] of [['link-tab',link],['file-tab',!link]] as const){el(id).classList.toggle('selected',active);el(id).setAttribute('aria-pressed',String(active));}if(link)input('media-url').focus();}
el('file-tab').onclick=()=>inputTab(false);el('link-tab').onclick=()=>inputTab(true);
el('link-entry').onsubmit=e=>{e.preventDefault();const result=el('link-result');result.replaceChildren();result.hidden=false;try{const c=classifyMediaLink(input('media-url').value);const heading=document.createElement('h2'),body=document.createElement('p');heading.textContent=c.title;body.textContent=c.message;result.append(heading,body);}catch(error){result.textContent=(error as Error).message;}};
const privacyButton=el<HTMLButtonElement>('privacy-button');
privacyButton.onclick=()=>{
  const show=el('privacy-panel').hidden;
  el('privacy-panel').hidden=!show;
  privacyButton.setAttribute('aria-expanded',String(show));
};
el('close-privacy').onclick=()=>{
  el('privacy-panel').hidden=true;
  privacyButton.setAttribute('aria-expanded','false');
  privacyButton.focus();
};
const categories: Record<string,[string,string]>={images:['Image tools, ready here.','Convert, resize, remove metadata, or make simple Photo adjustments. PNG, JPEG and WebP stay on your device.'],video:['Video is on the roadmap.','Transcoding, trimming and audio extraction are not available in this build. No video file is opened or uploaded.'],audio:['Audio is on the roadmap.','Local audio conversion will follow codec and distribution review. No audio processor is loaded.'],pdf:['One image, one PDF.','Choose a PNG, JPEG or WebP image, then create a single-page PDF locally. JPEG compression and a white background are used. This build does not open, render, merge or modify existing PDFs.'],documents:['Documents are on the roadmap.','Office document conversion is not supported yet. Files are never uploaded as a fallback.'],archives:['Archive tools are on the roadmap.','Extraction will require path, file-count and expanded-size protections. No archive extraction is available now.'],data:['Data tools are on the roadmap.','CSV and JSON inspection and conversion are planned. No data parsing is available in this build.'],creative:['Photo studio · a small beginning.','Crop, rotate, adjust brightness/contrast/saturation, black out sensitive regions and compare locally. Layers and PSD editing remain future work.']};
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-category]')) button.onclick=()=> {
  for(const b of document.querySelectorAll('[data-category]')){b.classList.remove('active');b.removeAttribute('aria-current');}button.classList.add('active');button.setAttribute('aria-current','page');
  const c=button.dataset.category!;const detail=categories[c];el('category-panel').hidden=!detail;
  if(detail){el('category-title').textContent=detail[0];el('category-copy').textContent=detail[1];}
  photoOpen=c==='creative';el('photo-tools').hidden=!photoOpen;syncCropControls();syncComparison();syncPhotoControls();inputTab(false);if(photoOpen&&info)showPhoto();
};
el('sample').onclick=async()=> {
  const canvas=document.createElement('canvas');canvas.width=960;canvas.height=640;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#d9cfe3';ctx.fillRect(0,0,960,640);ctx.fillStyle='#f2e5bd';ctx.beginPath();ctx.arc(670,210,115,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#9d91b2';ctx.beginPath();ctx.moveTo(0,540);ctx.quadraticCurveTo(280,40,660,640);ctx.lineTo(0,640);ctx.fill();
  ctx.fillStyle='#5d5777';ctx.beginPath();ctx.moveTo(280,640);ctx.quadraticCurveTo(710,220,960,370);ctx.lineTo(960,640);ctx.fill();
  ctx.fillStyle='#f5edd9';ctx.font='28px Georgia';ctx.fillText('a small shift in perspective',50,70);
  canvas.toBlob(blob=>{if(blob)void chooseFile(new File([blob],'astralys-sample.png',{type:'image/png'}));},'image/png');
};
// Separate local batch queue. One disposable worker per file, no archive dependency or auto-download.
const batchInput=input('batch-files');
const batchStatus=(message:string)=>{el('batch-status').textContent=message;};
function syncBatch() {
  batchInput.disabled=batchBusy;
  el<HTMLSelectElement>('batch-format').disabled=batchBusy;
  el<HTMLSelectElement>('batch-size').disabled=batchBusy;
  el<HTMLButtonElement>('batch-start').disabled=batchBusy||!batchFiles.length;
  el('batch-cancel').hidden=!batchBusy;
}
function clearBatch(announce=true) {
  ++batchSerial;batchRunner.cancel();batchBusy=false;batchFiles=[];
  batchStoredBytes=0;batchUrls.forEach(slot=>slot.clear());batchUrls.length=0;
  batchInput.value='';el('batch-results').replaceChildren();
  syncBatch();if(announce)batchStatus('Batch cleared. Select files to convert locally.');
}
batchInput.onchange=()=>{
  if(batchBusy)return;
  batchUrls.forEach(slot=>slot.clear());batchUrls.length=0;batchStoredBytes=0;
  el('batch-results').replaceChildren();
  batchFiles=Array.from(batchInput.files??[]);
  const total=batchFiles.reduce((n,f)=>n+f.size,0);
  if(batchFiles.length>8||total>48*1024*1024){
    batchFiles=[];batchInput.value='';
    batchStatus('Choose at most 8 images with no more than 48 MiB combined input.');
  }else batchStatus(batchFiles.length?batchFiles.length+' image(s) selected. Choose an output format, then convert.':'Select up to 8 still images.');
  syncBatch();
};
el('batch-clear').onclick=()=>clearBatch();
el('batch-cancel').onclick=()=>{
  if(!batchBusy)return;
  ++batchSerial;batchRunner.cancel();batchBusy=false;syncBatch();
  batchStatus('Batch cancelled. Completed downloads remain available until cleared.');
};
el('batch-start').onclick=async()=>{
  if(batchBusy||busy||!batchFiles.length){if(busy)batchStatus('Finish or cancel the current Photo edit first.');return;}
  const format=el<HTMLSelectElement>('batch-format').value as ImageMime;
  if(!['image/png','image/jpeg','image/webp'].includes(format)){batchStatus('Select PNG, JPEG or WebP.');return;}
  const chosenSize=el<HTMLSelectElement>('batch-size').value;
  const fitWithin=chosenSize==='original'?undefined:Number(chosenSize.slice('long-'.length));
  if(chosenSize!=='original'&&(!chosenSize.startsWith('long-')||!isLongEdge(fitWithin))){batchStatus('Select a supported batch size preset.');return;}
  const files=[...batchFiles],serial=++batchSerial;
  // Replacing results releases all previous Blob URLs before allocating new ones.
  batchUrls.forEach(slot=>slot.clear());batchUrls.length=0;batchStoredBytes=0;
  const results=el<HTMLOListElement>('batch-results');results.replaceChildren();
  batchBusy=true;syncBatch();
  let completed=0,failed=0;
  for(const [index,f] of files.entries()) {
    if(serial!==batchSerial)break;
    const li=document.createElement('li'),caption=document.createElement('span');
    caption.textContent=f.name+' — converting…';li.append(caption);results.append(li);
    batchStatus('Converting '+(index+1)+' of '+files.length+' images on this device…');
    try {
      const result=await batchRunner.run<ImageResult>({
        file:f,mode:'export',mime:format,quality:.85,photo:blankPhotoState(),fitWithin:fitWithin as LongEdge | undefined
      } satisfies ImageJob,()=>{});
      if(serial!==batchSerial)return;
      if(result.blob.size+batchStoredBytes>64*1024*1024)
        throw new Error('64 MiB batch output budget reached. Download the completed results or try smaller images.');
      const slot=new ObjectUrlSlot();const url=slot.set(result.blob);batchUrls.push(slot);
      batchStoredBytes+=result.blob.size;
      caption.textContent=f.name+' — '+result.width+' × '+result.height+' · '+formatBytes(result.blob.size)+' · ready';
      const link=document.createElement('a');
      link.href=url;link.download=safeName(f.name,format).replace(/(\.[^.]+)$/, '-' +(index+1)+'$1');
      link.textContent='Download file '+(index+1);li.append(link);completed++;
    }catch(error) {
      if(serial!==batchSerial)return;
      failed++;
      caption.className='batch-error';
      caption.textContent=f.name+' — '+(error instanceof Error?error.message:'Conversion failed.');
    }
  }
  if(serial!==batchSerial)return;
  batchBusy=false;syncBatch();
  batchStatus('Batch complete: '+completed+' ready, '+failed+' failed. Downloads are individual and optional; files stay in memory until cleared.');
};
window.addEventListener('pagehide',()=>{clearBatch(false);++requestId;runner.cancel();previewUrl.clear();originalPreviewUrl.clear();clearOutput();file=undefined;info=undefined;});
window.addEventListener('pageshow',e=>{if(e.persisted)clearSession();});
updateFormat();syncBatch();syncPhotoControls();
document.documentElement.dataset.appReady='true';
