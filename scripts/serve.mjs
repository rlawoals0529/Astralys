import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root=resolve('dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8'};
const headers={
 'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; worker-src 'self'; connect-src 'none'; font-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'none'",
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()', 'Cross-Origin-Opener-Policy':'same-origin','Cache-Control':'no-store'
};
createServer(async(req,res)=>{
 try {
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,headers).end();return;}
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  // Cloudflare parses _headers as deployment metadata and does not serve it as an asset.
  // Mirror that contract in the localhost verification server.
  if(path==='/_headers'||/(?:^|\/)\.[^/]+/.test(path)||/\.map$/i.test(path)){res.writeHead(404,headers).end('Not found');return;}
  const file=resolve(root,'.'+(path==='/'?'/index.html':path));
  if(!file.startsWith(root+sep)){res.writeHead(403,headers).end();return;}
  const bytes=await readFile(file);res.writeHead(200,{...headers,'Content-Type':types[extname(file)]??'application/octet-stream'});res.end(req.method==='HEAD'?undefined:bytes);
 }catch{res.writeHead(404,headers).end('Not found');}
}).listen(4173,'127.0.0.1',()=>console.log('Astralys local verification server: http://127.0.0.1:4173'));
