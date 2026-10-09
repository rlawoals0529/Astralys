import { it,expect } from 'vitest';
import { classifyMediaLink,YOUTUBE_RESOLVER_ENABLED } from '../src/core/media';
import { PhotoHistory } from '../src/core/photo';
it.each(['https://youtube.com/watch?v=abc','https://www.youtube.com/watch?v=abc','https://youtu.be/abc'])('recognizes but never enables YouTube %s',url=>{expect(classifyMediaLink(url)).toMatchObject({provider:'youtube',enabled:false});expect(YOUTUBE_RESOLVER_ENABLED).toBe(false);});
it.each(['http://example.com','file:///etc/passwd','javascript:alert(1)','https://user:password@example.com','https://example.com:8443/','invalid','x'.repeat(2049)])('rejects invalid links %s',url=>expect(()=>classifyMediaLink(url)).toThrow());
it('does not mistake a lookalike host for YouTube',()=>expect(classifyMediaLink('https://youtube.com.evil.example/watch')).toMatchObject({provider:'unsupported',enabled:false}));
it('does not treat local classification as permission to fetch',()=>expect(classifyMediaLink('https://127.0.0.1/a.mp4')).toMatchObject({enabled:false}));
it('restores editing state through undo/reset without altering original',()=>{const h=new PhotoHistory();h.rotate();h.flip();expect(h.current).toEqual({turns:1,flip:true});h.undo();expect(h.current).toEqual({turns:1,flip:false});h.reset();expect(h.current).toEqual({turns:0,flip:false});expect(h.canUndo).toBe(false);});
it('rolls back a cancelled edit checkpoint and keeps undo history',()=>{const h=new PhotoHistory();h.rotate();const c=h.checkpoint();h.flip();h.restore(c);expect(h.current).toEqual({turns:1,flip:false});h.undo();expect(h.current.turns).toBe(0);});
