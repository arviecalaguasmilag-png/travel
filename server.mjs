import http from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'public');
const types={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',svg:'image/svg+xml',webmanifest:'application/manifest+json'};
const names=['index.html','app.js','links.js','places.js','trips.js','styles.css','icon.svg','sw.js','manifest.webmanifest','privacy.html'];
const files=new Map(names.map(name=>['/'+name,{body:readFileSync(resolve(root,name)),type:types[name.split('.').at(-1)]}]));
const server=http.createServer((req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Permissions-Policy','geolocation=(), camera=(), microphone=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  const path=new URL(req.url,'http://localhost').pathname;
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});return res.end();}
  if(path==='/health'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(req.method==='HEAD'?undefined:'{"ok":true}');}
  const file=files.get(path==='/'?'/index.html':path);
  if(!file){res.writeHead(404,{'Content-Type':'text/plain'});return res.end('Not found');}
  res.writeHead(200,{'Content-Type':file.type,'Cache-Control':'no-cache'});
  res.end(req.method==='HEAD'?undefined:file.body);
});
server.listen(Number(process.env.PORT)||4174,process.env.NODE_ENV==='production'?'0.0.0.0':'127.0.0.1',()=>console.log('Travel is ready.'));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
