export const FRAME_PRESETS = ['original','square','portrait','classic','wide'] as const;
export type FramePreset = typeof FRAME_PRESETS[number];
export type ToneAxis = 'brightness'|'contrast'|'saturation';
export interface RedactionRect { x:number; y:number; width:number; height:number; }
export interface PhotoState {
  turns: number; flip: boolean; frame: FramePreset; cropX: number; cropY: number;
  brightness:number; contrast:number; saturation:number; redactions:RedactionRect[];
}
export interface FrameBounds { x: number; y: number; width: number; height: number; }
const validPosition = (n: number) => Number.isInteger(n) && n >= 0 && n <= 100;
const validTone = (n:number)=> Number.isInteger(n)&&n>=-100&&n<=100;
export function validRedaction(r:RedactionRect):boolean {
  return !!r && [r.x,r.y,r.width,r.height].every(Number.isInteger) &&
    r.x>=0 && r.y>=0 && r.width>=1 && r.height>=1 &&
    r.x+r.width<=100 && r.y+r.height<=100;
}
export function validatePhotoState(s:PhotoState) {
  if(!s||!Number.isInteger(s.turns)||s.turns<0||s.turns>3||typeof s.flip!=='boolean'||
     !isFramePreset(s.frame)||!validPosition(s.cropX)||!validPosition(s.cropY)||
     !validTone(s.brightness)||!validTone(s.contrast)||!validTone(s.saturation)||
     !Array.isArray(s.redactions)||s.redactions.length>10||!s.redactions.every(validRedaction))
    throw new Error('Invalid photo operation.');
}
export function isFramePreset(value: unknown): value is FramePreset {
  return typeof value === 'string' && (FRAME_PRESETS as readonly string[]).includes(value);
}
/** A pixel-accurate crop in oriented source coordinates. 0/100 are the extreme edges. */
export function frameBounds(width: number, height: number, frame: FramePreset, cropX=50, cropY=50): FrameBounds {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 ||
      !isFramePreset(frame) || !validPosition(cropX) || !validPosition(cropY))
    throw new Error('Invalid image framing.');
  const ratios: Record<Exclude<FramePreset,'original'>, readonly [number,number]> = {
    square: [1,1], portrait: [4,5], classic: [4,3], wide: [16,9]
  };
  if (frame === 'original') return {x:0,y:0,width,height};
  const [rw,rh] = ratios[frame];
  let w = width, h = height;
  if (width * rh > height * rw) w = Math.max(1,Math.floor(height * rw / rh));
  else h = Math.max(1,Math.floor(width * rh / rw));
  return {x:Math.floor((width-w)*cropX/100),y:Math.floor((height-h)*cropY/100),width:w,height:h};
}
/** Work in straight-alpha canvas RGBA. Never change the alpha channel. */
export function applyTone(pixels:Uint8ClampedArray,brightness:number,contrast:number,saturation:number):void {
  if(![brightness,contrast,saturation].every(validTone)||pixels.length%4!==0)
    throw new Error('Invalid tonal adjustment.');
  if(!brightness&&!contrast&&!saturation)return;
  const contrastFactor=Math.pow(2,contrast/50), saturationFactor=1+saturation/100;
  const shift=brightness*255/100;
  for(let i=0;i<pixels.length;i+=4) {
    if(pixels[i+3]===0) { pixels[i]=0;pixels[i+1]=0;pixels[i+2]=0;continue; }
    let r=pixels[i],g=pixels[i+1],b=pixels[i+2];
    const grey=.2126*r+.7152*g+.0722*b;
    r=(grey+(r-grey)*saturationFactor-127.5)*contrastFactor+127.5+shift;
    g=(grey+(g-grey)*saturationFactor-127.5)*contrastFactor+127.5+shift;
    b=(grey+(b-grey)*saturationFactor-127.5)*contrastFactor+127.5+shift;
    pixels[i]=r;pixels[i+1]=g;pixels[i+2]=b;
  }
}
/** Opaque rectangle bounds in final output pixels, expanded outward for full coverage. */
export function redactionBounds(w:number,h:number,r:RedactionRect):FrameBounds {
  if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1||!validRedaction(r))
    throw new Error('Invalid redaction rectangle.');
  const x=Math.floor(w*r.x/100), y=Math.floor(h*r.y/100);
  const x2=Math.min(w,Math.max(x+1,Math.ceil(w*(r.x+r.width)/100)));
  const y2=Math.min(h,Math.max(y+1,Math.ceil(h*(r.y+r.height)/100)));
  return {x,y,width:x2-x,height:y2-y};
}
export const blankPhotoState=():PhotoState=>({turns:0,flip:false,frame:'original',cropX:50,cropY:50,brightness:0,contrast:0,saturation:0,redactions:[]});
const copy=(s:PhotoState):PhotoState=>({...s,redactions:s.redactions.map(r=>({...r}))});
export class PhotoHistory {
  private states: PhotoState[] = [blankPhotoState()];
  get current() { return this.states.at(-1)!; }
  get canUndo() { return this.states.length>1; }
  checkpoint() { return this.states.map(copy); }
  restore(states: PhotoState[]) {
    if(!states.length||states.length>33)throw new Error('Invalid undo checkpoint.');
    states.forEach(validatePhotoState);
    this.states=states.map(copy);
  }
  rotate() { this.push({...this.current,turns:(this.current.turns+1)%4}); }
  flip() { this.push({...this.current,flip:!this.current.flip}); }
  setFrame(frame: FramePreset) {
    if(!isFramePreset(frame)) throw new Error('Invalid image framing.');
    if(frame!==this.current.frame)this.push({...this.current,frame});
  }
  setPosition(cropX: number,cropY: number) {
    if(!validPosition(cropX)||!validPosition(cropY))throw new Error('Crop positions must be whole percentages from 0 to 100.');
    if(cropX!==this.current.cropX||cropY!==this.current.cropY)this.push({...this.current,cropX,cropY});
  }
  setTone(axis:ToneAxis,value:number) {
    if(!['brightness','contrast','saturation'].includes(axis)||!validTone(value))
      throw new Error('Invalid tonal adjustment.');
    if(value!==this.current[axis])this.push({...this.current,[axis]:value});
  }
  resetTone() {
    if(this.current.brightness||this.current.contrast||this.current.saturation)
      this.push({...this.current,brightness:0,contrast:0,saturation:0});
  }
  addRedaction(rect:RedactionRect) {
    if(!validRedaction(rect))throw new Error('Redaction must be inside the image with a nonzero area.');
    if(this.current.redactions.length>=10)throw new Error('You can add at most 10 redactions per image.');
    this.push({...this.current,redactions:[...this.current.redactions,{...rect}]});
  }
  undo() { if(this.canUndo)this.states.pop(); }
  reset() { this.states=[blankPhotoState()]; }
  private push(state: PhotoState) {
    validatePhotoState(state);
    this.states.push(copy(state)); if(this.states.length>32)this.states.splice(1,1);
  }
}
