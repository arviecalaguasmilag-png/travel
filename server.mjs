import http from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {createRateService} from './rates.mjs';
import {CURRENCIES} from './public/currency.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'public');
const types={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',svg:'image/svg+xml',webmanifest:'application/manifest+json'};
const names=['index.html','app.js','links.js','places.js','trips.js','currency.js','place-actions.js','styles.css','icon.svg','sw.js','manifest.webmanifest','privacy.html'];
const files=new Map(names.map(name=>['/'+name,{body:readFileSync(resolve(root,name)),type:types[name.split('.').at(-1)]}]));
const getRate=createRateService();
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Permissions-Policy','geolocation=(), camera=(), microphone=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  const path=new URL(req.url,'http://localhost').pathname;
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});return res.end();}
  if(path==='/health'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(req.method==='HEAD'?undefined:'{"ok":true}');}
  if(path==='/api/rates'){
    const base=new URL(req.url,'http://localhost').searchParams.get('base');
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    if(!CURRENCIES.includes(base)){res.writeHead(400);return res.end(req.method==='HEAD'?undefined:JSON.stringify({error:'Choose a supported currency.'}));}
    if(req.method==='HEAD'){res.writeHead(200);return res.end();}
    try{const rate=await getRate(base);res.writeHead(200);return res.end(JSON.stringify(rate));}
    catch(error){res.writeHead(503);return res.end(JSON.stringify({error:error.message}));}
  }
  const file=files.get(path==='/'?'/index.html':path);
  if(!file){res.writeHead(404,{'Content-Type':'text/plain'});return res.end('Not found');}
  res.writeHead(200,{'Content-Type':file.type,'Cache-Control':'no-cache'});
  res.end(req.method==='HEAD'?undefined:file.body);
});
server.listen(process.env.PORT===undefined?4174:Number(process.env.PORT),process.env.NODE_ENV==='production'?'0.0.0.0':'127.0.0.1',()=>console.log(`Travel is ready at http://127.0.0.1:${server.address().port}`));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
