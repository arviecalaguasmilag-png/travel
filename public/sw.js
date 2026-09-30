const CACHE='travel-shell-v2';
const FILES=['/','/index.html','/app.js','/links.js','/places.js','/trips.js','/styles.css','/icon.svg','/manifest.webmanifest','/privacy.html'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&(k.startsWith('travel-shell-')||k.startsWith('taiwan-free-shell-'))).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!FILES.includes(url.pathname))return;
  event.respondWith(fetch(event.request).then(response=>{
    if(!response.ok)return caches.match(url.pathname).then(cached=>cached||response);
    const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(url.pathname,copy)));return response;
  }).catch(()=>caches.match(url.pathname)));
});
