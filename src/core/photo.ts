export const FRAME_PRESETS = ['original','square','portrait','classic','wide'] as const;
export type FramePreset = typeof FRAME_PRESETS[number];
export function isFramePreset(value: unknown): value is FramePreset {
  return typeof value === 'string' && (FRAME_PRESETS as readonly string[]).includes(value);
}
export interface PhotoState { turns: number; flip: boolean; frame: FramePreset; cropX: number; cropY: number; }
export interface FrameBounds { x: number; y: number; width: number; height: number; }
const validPosition = (n: number) => Number.isInteger(n) && n >= 0 && n <= 100;
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
export class PhotoHistory {
  private states: PhotoState[] = [{turns:0,flip:false,frame:'original',cropX:50,cropY:50}];
  get current() { return this.states.at(-1)!; }
  get canUndo() { return this.states.length>1; }
  checkpoint() { return this.states.map(s=>({...s})); }
  restore(states: PhotoState[]) { this.states=states.map(s=>({...s})); }
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
  undo() { if(this.canUndo)this.states.pop(); }
  reset() { this.states=[{turns:0,flip:false,frame:'original',cropX:50,cropY:50}]; }
  private push(state: PhotoState) { this.states.push(state); if(this.states.length>32)this.states.splice(1,1); }
}
