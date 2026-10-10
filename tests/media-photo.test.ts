import { it,expect } from 'vitest';
import { classifyMediaLink,YOUTUBE_RESOLVER_ENABLED } from '../src/core/media';
import { PhotoHistory, frameBounds, isFramePreset } from '../src/core/photo';
it.each(['https://youtube.com/watch?v=abc','https://www.youtube.com/watch?v=abc','https://youtu.be/abc'])('recognizes but never enables YouTube %s',url=>{expect(classifyMediaLink(url)).toMatchObject({provider:'youtube',enabled:false});expect(YOUTUBE_RESOLVER_ENABLED).toBe(false);});
it.each(['http://example.com','file:///etc/passwd','javascript:alert(1)','https://user:password@example.com','https://example.com:8443/','invalid','x'.repeat(2049)])('rejects invalid links %s',url=>expect(()=>classifyMediaLink(url)).toThrow());
it('does not mistake a lookalike host for YouTube',()=>expect(classifyMediaLink('https://youtube.com.evil.example/watch')).toMatchObject({provider:'unsupported',enabled:false}));
it('does not treat local classification as permission to fetch',()=>expect(classifyMediaLink('https://127.0.0.1/a.mp4')).toMatchObject({enabled:false}));
it('restores editing state through undo/reset without altering original',()=>{const h=new PhotoHistory();h.rotate();h.flip();expect(h.current).toEqual({turns:1,flip:true,frame:'original',cropX:50,cropY:50});h.undo();expect(h.current).toEqual({turns:1,flip:false,frame:'original',cropX:50,cropY:50});h.reset();expect(h.current).toEqual({turns:0,flip:false,frame:'original',cropX:50,cropY:50});expect(h.canUndo).toBe(false);});
it('rolls back a cancelled edit checkpoint and keeps undo history',()=>{const h=new PhotoHistory();h.rotate();const c=h.checkpoint();h.flip();h.restore(c);expect(h.current).toEqual({turns:1,flip:false,frame:'original',cropX:50,cropY:50});h.undo();expect(h.current.turns).toBe(0);});

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
  expect(history.current).toEqual({turns:0,flip:false,frame:'square',cropX:50,cropY:50});
  const checkpoint=history.checkpoint();
  history.rotate();
  history.flip();
  history.setFrame('portrait');
  expect(history.current).toEqual({turns:1,flip:true,frame:'portrait',cropX:50,cropY:50});
  history.undo();
  expect(history.current).toEqual({turns:1,flip:true,frame:'square',cropX:50,cropY:50});
  history.restore(checkpoint);
  expect(history.current).toEqual({turns:0,flip:false,frame:'square',cropX:50,cropY:50});
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
