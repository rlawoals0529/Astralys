import { it,expect } from 'vitest';
import { classifyMediaLink,YOUTUBE_RESOLVER_ENABLED } from '../src/core/media';
import { PhotoHistory, applyTone, frameBounds, isFramePreset, redactionBounds, validRedaction, validatePhotoState } from '../src/core/photo';
it.each(['https://youtube.com/watch?v=abc','https://www.youtube.com/watch?v=abc','https://youtu.be/abc'])('recognizes but never enables YouTube %s',url=>{expect(classifyMediaLink(url)).toMatchObject({provider:'youtube',enabled:false});expect(YOUTUBE_RESOLVER_ENABLED).toBe(false);});
it.each(['http://example.com','file:///etc/passwd','javascript:alert(1)','https://user:password@example.com','https://example.com:8443/','invalid','x'.repeat(2049)])('rejects invalid links %s',url=>expect(()=>classifyMediaLink(url)).toThrow());
it('does not mistake a lookalike host for YouTube',()=>expect(classifyMediaLink('https://youtube.com.evil.example/watch')).toMatchObject({provider:'unsupported',enabled:false}));
it('does not treat local classification as permission to fetch',()=>expect(classifyMediaLink('https://127.0.0.1/a.mp4')).toMatchObject({enabled:false}));
it.each(['https://127.0.0.1/a.mp4','https://[::1]/a.mp4','https://localhost/a.mp4','https://machine.local/a.mp4','https://r1.googlevideo.com/a.mp4'])('offers no source action for %s',url=>expect(classifyMediaLink(url).links).toBeUndefined());
it('preserves supplied HTTPS source without pretending it is a download',()=>expect(classifyMediaLink('https://media.example/video.mp4?token=abc')).toMatchObject({enabled:false,links:[{label:'Open supplied media URL',href:'https://media.example/video.mp4?token=abc'}]}));
it('offers official owner routes with YouTube still disabled',()=>expect(classifyMediaLink('https://youtu.be/abc').links?.map(link=>link.href)).toEqual(['https://youtu.be/abc','https://support.google.com/youtube/answer/56100','https://studio.youtube.com/','https://takeout.google.com/']));
it('restores editing state through undo/reset without altering original',()=>{const h=new PhotoHistory();h.rotate();h.flip();expect(h.current).toEqual({turns:1,flip:true,frame:'original',cropX:50,cropY:50,brightness:0,contrast:0,saturation:0,redactions:[]});h.undo();expect(h.current).toEqual({turns:1,flip:false,frame:'original',cropX:50,cropY:50,brightness:0,contrast:0,saturation:0,redactions:[]});h.reset();expect(h.current).toEqual({turns:0,flip:false,frame:'original',cropX:50,cropY:50,brightness:0,contrast:0,saturation:0,redactions:[]});expect(h.canUndo).toBe(false);});
it('rolls back a cancelled edit checkpoint and keeps undo history',()=>{const h=new PhotoHistory();h.rotate();const c=h.checkpoint();h.flip();h.restore(c);expect(h.current).toEqual({turns:1,flip:false,frame:'original',cropX:50,cropY:50,brightness:0,contrast:0,saturation:0,redactions:[]});h.undo();expect(h.current.turns).toBe(0);});

it('centers common aspect ratios without changing the original oriented dimensions',()=>{
  expect(frameBounds(8,4,'original')).toEqual({x:0,y:0,width:8,height:4});
  expect(frameBounds(8,4,'square')).toEqual({x:2,y:0,width:4,height:4});
  expect(frameBounds(8,4,'portrait')).toEqual({x:2,y:0,width:3,height:4});
  expect(frameBounds(8,4,'classic')).toEqual({x:1,y:0,width:5,height:4});
  expect(frameBounds(8,4,'wide')).toEqual({x:0,y:0,width:7,height:4});
  expect(frameBounds(4,8,'square')).toEqual({x:0,y:2,width:4,height:4});
  expect(frameBounds(1,1,'wide')).toEqual({x:0,y:0,width:1,height:1});
});
it('rejects invalid crop formats or geometry instead of trying to draw them',()=>{
  expect(isFramePreset('wide')).toBe(true);
  expect(isFramePreset('made-up')).toBe(false);
  for (const [w,h,frame] of [[0,4,'square'],[-1,3,'wide'],[NaN,4,'original'],[8,4,'invalid']] as const)
    expect(()=>frameBounds(w,h,frame as 'square')).toThrow('Invalid image framing');
});
it('crop presets are undoable with the rest of the photo edits and reset stays non-destructive',()=>{
  const history=new PhotoHistory();
  history.setFrame('square');
  expect(history.current).toEqual({turns:0,flip:false,frame:'square',cropX:50,cropY:50,brightness:0,contrast:0,saturation:0,redactions:[]});
  const checkpoint=history.checkpoint();
  history.rotate();
  history.flip();
  history.setFrame('portrait');
  expect(history.current).toEqual({turns:1,flip:true,frame:'portrait',cropX:50,cropY:50,brightness:0,contrast:0,saturation:0,redactions:[]});
  history.undo();
  expect(history.current).toEqual({turns:1,flip:true,frame:'square',cropX:50,cropY:50,brightness:0,contrast:0,saturation:0,redactions:[]});
  history.restore(checkpoint);
  expect(history.current).toEqual({turns:0,flip:false,frame:'square',cropX:50,cropY:50,brightness:0,contrast:0,saturation:0,redactions:[]});
  history.setFrame('square');
  expect(history.canUndo).toBe(true);
  history.undo();
  expect(history.canUndo).toBe(false);
  history.reset();
  expect(history.current.frame).toBe('original');
});

it('repositions crops at left/right/top/bottom boundaries and rounds to source pixels',()=>{
  expect(frameBounds(8,4,'square',0,50)).toEqual({x:0,y:0,width:4,height:4});
  expect(frameBounds(8,4,'square',100,50)).toEqual({x:4,y:0,width:4,height:4});
  expect(frameBounds(8,4,'square',25,50)).toEqual({x:1,y:0,width:4,height:4});
  expect(frameBounds(4,8,'square',50,0)).toEqual({x:0,y:0,width:4,height:4});
  expect(frameBounds(4,8,'square',50,100)).toEqual({x:0,y:4,width:4,height:4});
  expect(frameBounds(8,4,'original',100,0)).toEqual({x:0,y:0,width:8,height:4});
  expect(frameBounds(1,1,'wide',0,100)).toEqual({x:0,y:0,width:1,height:1});
});
it('rejects non-finite, fractional or out-of-range crop positions',()=>{
  for(const n of [-1,101,1.25,Number.NaN,Infinity,Number.NEGATIVE_INFINITY]){
    expect(()=>frameBounds(8,4,'square',n,50)).toThrow('Invalid image framing');
    expect(()=>frameBounds(8,4,'square',50,n)).toThrow('Invalid image framing');
    expect(()=>new PhotoHistory().setPosition(50,n)).toThrow('Crop positions');
  }
});
it('stores crop position in one undoable checkpoint and resets it without mutating the source',()=>{
  const h=new PhotoHistory();h.setFrame('square');
  const initial=h.checkpoint();h.setPosition(0,100);
  expect(h.current).toMatchObject({frame:'square',cropX:0,cropY:100});
  h.rotate();expect(h.current.cropX).toBe(0);
  h.undo();expect(h.current.cropY).toBe(100);
  h.undo();expect(h.current).toMatchObject({frame:'square',cropX:50,cropY:50});
  h.setPosition(100,0);h.restore(initial);
  expect(h.current).toMatchObject({frame:'square',cropX:50,cropY:50});
  h.setPosition(50,50);expect(h.checkpoint()).toEqual(initial);
  h.reset();expect(h.current).toMatchObject({frame:'original',cropX:50,cropY:50});
});

it('new tonal controls are validated and restore through one undo checkpoint',()=>{
  const h=new PhotoHistory();h.setTone('brightness',35);h.setTone('contrast',-20);
  h.setTone('saturation',-100);
  expect(h.current).toMatchObject({brightness:35,contrast:-20,saturation:-100});
  const previous=h.checkpoint();
  h.resetTone();expect(h.current).toMatchObject({brightness:0,contrast:0,saturation:0});
  h.undo();expect(h.current).toMatchObject({brightness:35,contrast:-20,saturation:-100});
  h.restore(previous);expect(h.current.saturation).toBe(-100);
  for(const v of [101,-101,NaN,Infinity,0.5]) expect(()=>h.setTone('brightness',v)).toThrow('Invalid tonal adjustment.');
});
it('tone math changes color but never alpha and protects completely transparent pixels',()=>{
  const pixels=new Uint8ClampedArray([80,120,160,128,205,180,50,0]);
  applyTone(pixels,20,0,-100);
  expect(pixels[0]).toBe(pixels[1]);
  expect(pixels[1]).toBe(pixels[2]);
  expect(pixels[3]).toBe(128);
  expect(Array.from(pixels.slice(4))).toEqual([0,0,0,0]);
  const identity=new Uint8ClampedArray([12,25,240,30]);applyTone(identity,0,0,0);
  expect(Array.from(identity)).toEqual([12,25,240,30]);
  expect(()=>applyTone(new Uint8ClampedArray([1,2,3]),0,0,0)).toThrow();
});
it('redaction rectangles are fully bounded and rasterize to inclusive opaque pixel regions',()=>{
  expect(redactionBounds(8,4,{x:0,y:0,width:50,height:100})).toEqual({x:0,y:0,width:4,height:4});
  expect(redactionBounds(8,4,{x:75,y:0,width:25,height:50})).toEqual({x:6,y:0,width:2,height:2});
  expect(redactionBounds(3,3,{x:99,y:99,width:1,height:1})).toEqual({x:2,y:2,width:1,height:1});
  for(const r of [{x:-1,y:0,width:20,height:20},{x:50,y:50,width:60,height:30},{x:0,y:0,width:0,height:10},{x:1.5,y:0,width:30,height:30}]) {
    expect(validRedaction(r)).toBe(false);
    expect(()=>redactionBounds(10,10,r)).toThrow();
  }
});
it('black pixel redactions are non-destructive in history and capped at ten',()=>{
  const h=new PhotoHistory();const r={x:0,y:0,width:40,height:60};
  h.addRedaction(r);r.width=2;
  expect(h.current.redactions[0].width).toBe(40);
  const checkpoint=h.checkpoint();h.addRedaction({x:60,y:0,width:40,height:60});
  h.undo();expect(h.current.redactions).toHaveLength(1);
  h.restore(checkpoint);expect(h.current.redactions).toHaveLength(1);
  h.setTone('contrast',10);expect(h.current.redactions).toHaveLength(1);
  for(let i=0;i<9;i++) h.addRedaction({x:0,y:0,width:1,height:1});
  expect(h.current.redactions).toHaveLength(10);
  expect(()=>h.addRedaction({x:1,y:1,width:1,height:1})).toThrow('at most 10');
  h.reset();expect(h.current.redactions).toEqual([]);
  expect(()=>validatePhotoState({...h.current,redactions:[{x:95,y:95,width:20,height:20}]})).toThrow();
});
