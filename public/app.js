import {validatePlaces,directionsLink} from './links.js';
import {STORAGE_KEY,LEGACY_KEY,initialState,validateTrip,validateState,encodeTrip,importPayload,importHash,addImportedTrips} from './trips.js';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=initialState(),pendingImport=null,storageReadFailed=false;
try{const saved=localStorage.getItem(STORAGE_KEY),legacy=localStorage.getItem(LEGACY_KEY);state=saved?validateState(JSON.parse(saved)):initialState(legacy?JSON.parse(legacy):undefined);if(!saved)localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
catch{storageReadFailed=true;storageWarning('Saved data could not be loaded. Your original browser data has been kept; changes are temporary until storage is available.');}
function storageWarning(text){$('#storage-note').textContent=text;$('#storage-note').hidden=false;}
function commit(next){state=validateState(next);if(!storageReadFailed){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));$('#storage-note').hidden=true;}catch{storageWarning('This browser cannot save changes permanently. Back up all trips before closing it.');}}render();}
const trip=()=>state.trips.find(t=>t.id===state.activeTripId);
const getPlace=id=>trip().places.find(p=>p.id===id);
const destination=()=>getPlace($('#destination').value);
const selections=new Map();
function render(){
  $('#trip-select').innerHTML=state.trips.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');$('#trip-select').value=state.activeTripId;
  const t=trip(),saved=selections.get(t.id),options=t.places.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  $('#origin').innerHTML='<option value="current">My location</option>'+options;$('#destination').innerHTML=options||'<option value="">Add a destination first</option>';
  $('#origin').value=saved?.origin==='current'||getPlace(saved?.origin)?saved.origin:t.places.length>1?t.places[0].id:'current';
  $('#destination').value=getPlace(saved?.destination)?saved.destination:t.places[1]?.id||t.places[0]?.id||'';
  $('#destination').disabled=!t.places.length;$('#copy-address').disabled=!t.places.length;$('#swap').disabled=!t.places.length;$('#empty-note').hidden=t.places.length>0;
  $('#country-label').textContent=t.country;$('#place-address').placeholder=`Place, city, ${t.country}`;update();clock();
}
function update(){
  const from=getPlace($('#origin').value),to=destination(),mode=$('input[name=mode]:checked').value;
  selections.set(trip().id,{origin:$('#origin').value,destination:$('#destination').value});
  $('#origin-caption').textContent=from?from.localName:'Google Maps will find your location';$('#destination-caption').textContent=to?.localName||'';
  $('#directions-link').href=directionsLink(from,to,mode);$('#directions-link').setAttribute('aria-disabled',String(!to));
  $('#directions-link').innerHTML=({transit:'Find bus &amp; train routes',driving:'See driving directions',walking:'See walking directions'})[mode]+' <span aria-hidden="true">↗</span>';
  $('#directions-hint').textContent=mode==='transit'?'Opens Google Maps for departures, service numbers, and stops.':mode==='driving'?'Opens Google Maps for a driving estimate. Check Uber for its fare and pickup wait.':'Opens Google Maps for walking directions and estimated travel time.';
  $('#status').textContent=to&&from?.id===to.id?'Choose a different starting point or destination.':'';
}
$('#trip-select').addEventListener('change',()=>commit({...state,activeTripId:$('#trip-select').value}));
for(const id of ['origin','destination'])$('#'+id).addEventListener('change',update);
document.querySelectorAll('input[name=mode]').forEach(el=>el.addEventListener('change',update));
$('#swap').addEventListener('click',()=>{if($('#origin').value==='current'){$('#status').textContent='Choose a saved starting point before swapping.';return;}const from=$('#origin').value;$('#origin').value=$('#destination').value;$('#destination').value=from;update();});
$('#directions-link').addEventListener('click',event=>{if(!destination()||$('#origin').value===$('#destination').value){event.preventDefault();$('#status').textContent=!destination()?'Add a destination under Saved places first.':'Choose two different places.';}});
async function copyText(text,success,target='#status'){try{await navigator.clipboard.writeText(text);$(target).textContent=success;}catch{$('#copy-text').value=text;$('#copy-dialog').showModal();$('#copy-text').select();}}
$('#copy-address').addEventListener('click',()=>{const p=destination();if(p)copyText([p.localName,p.name,p.address].filter(Boolean).join('\n'),'Destination copied. Paste it into Uber.');});
const zones=[...new Set(['UTC','Asia/Taipei','Asia/Tokyo',...(Intl.supportedValuesOf?.('timeZone')||[])])].sort();
function zoneOptions(selected){const list=[...new Set([...zones,selected])].filter(Boolean).sort();$('#trip-timezone').innerHTML=list.map(z=>`<option value="${esc(z)}">${esc(z.replaceAll('_',' '))}</option>`).join('');$('#trip-timezone').value=selected;}
function editTrip(existing){$('#trip-form').reset();$('#trip-id').value=existing?.id||'';$('#trip-title').textContent=existing?'Edit trip':'New trip';$('#trip-name').value=existing?.name||'';$('#trip-country').value=existing?.country||'';zoneOptions(existing?.timeZone||'UTC');$('#trip-error').textContent='';$('#trip-dialog').showModal();}
$('#new-trip').addEventListener('click',()=>editTrip(null));$('#edit-trip').addEventListener('click',()=>editTrip(trip()));
const countryZones={taiwan:'Asia/Taipei',japan:'Asia/Tokyo','south korea':'Asia/Seoul',philippines:'Asia/Manila',singapore:'Asia/Singapore',thailand:'Asia/Bangkok',vietnam:'Asia/Ho_Chi_Minh',malaysia:'Asia/Kuala_Lumpur','hong kong':'Asia/Hong_Kong','united kingdom':'Europe/London',france:'Europe/Paris',italy:'Europe/Rome',germany:'Europe/Berlin','new zealand':'Pacific/Auckland'};
$('#trip-country').addEventListener('change',()=>{if(!$('#trip-id').value){const z=countryZones[$('#trip-country').value.trim().toLowerCase()];zoneOptions(z||'UTC');}});
$('#trip-form').addEventListener('submit',event=>{event.preventDefault();try{const id=$('#trip-id').value||crypto.randomUUID(),existing=state.trips.find(t=>t.id===id);const next=validateTrip({id,name:$('#trip-name').value,country:$('#trip-country').value,timeZone:$('#trip-timezone').value,places:existing?.places||[]});commit({...state,activeTripId:id,trips:existing?state.trips.map(t=>t.id===id?next:t):[...state.trips,next]});$('#trip-dialog').close();}catch(e){$('#trip-error').textContent=e.message;}});
function savePlaces(places){commit({...state,trips:state.trips.map(t=>t.id===state.activeTripId?{...t,places:validatePlaces(places)}:t)});}
function resetPlaceForm(){$('#place-form').reset();$('#place-id').value='';$('#place-form-title').textContent='Add a place';$('#cancel-place-edit').hidden=true;}
function renderPlaces(){
  $('#places-context').textContent=`${trip().name} · ${trip().country}. Saved on this device; share again after making changes.`;
  $('#saved-places').innerHTML=trip().places.map(p=>`<li><span class="place-details"><strong>${esc(p.name)}</strong>${p.localName?' · '+esc(p.localName):''}<small>${esc(p.address)}</small></span><span class="place-actions"><button class="text-button edit-place" data-id="${esc(p.id)}" aria-label="Edit ${esc(p.name)}">Edit</button><button class="text-button remove-place" data-id="${esc(p.id)}" aria-label="Remove ${esc(p.name)}">Remove</button></span></li>`).join('');
  $('#saved-places').querySelectorAll('.remove-place').forEach(b=>b.addEventListener('click',()=>{savePlaces(trip().places.filter(p=>p.id!==b.dataset.id));renderPlaces();resetPlaceForm();$('#place-error').textContent='Place removed from this trip.';}));
  $('#saved-places').querySelectorAll('.edit-place').forEach(b=>b.addEventListener('click',()=>{const p=getPlace(b.dataset.id);$('#place-id').value=p.id;$('#place-name').value=p.name;$('#place-address').value=p.address;$('#place-local').value=p.localName;$('#place-form-title').textContent='Edit place';$('#cancel-place-edit').hidden=false;$('#place-name').focus();}));
}
$('#places-button').addEventListener('click',()=>{renderPlaces();resetPlaceForm();$('#place-error').textContent='';$('#places-dialog').showModal();});$('#cancel-place-edit').addEventListener('click',resetPlaceForm);
$('#place-form').addEventListener('submit',event=>{event.preventDefault();try{const id=$('#place-id').value||crypto.randomUUID(),p={id,name:$('#place-name').value.trim(),address:$('#place-address').value.trim(),localName:$('#place-local').value.trim()};savePlaces(trip().places.some(x=>x.id===id)?trip().places.map(x=>x.id===id?p:x):[...trip().places,p]);renderPlaces();resetPlaceForm();$('#place-error').textContent='Saved on this device.';}catch(e){$('#place-error').textContent=e.message;}});
$('#share-trip').addEventListener('click',async()=>{const url=new URL(location.pathname,location.origin);url.hash='trip='+encodeTrip(trip());if(url.href.length>12000){$('#place-error').textContent='This trip is too long for a reliable link. Send a backup file instead.';return;}if(navigator.share){try{await navigator.share({title:trip().name,text:'Open this link to copy our trip and places.',url:url.href});return;}catch(e){if(e.name==='AbortError')return;}}await copyText(url.href,'Link copied. It includes this trip’s settings, place names, and addresses.','#place-error');});
$('#export-trips').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='travel-trips.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('#place-error').textContent='Backup downloaded. It contains every trip and its places.';});
function previewImport(trips){pendingImport=trips.map(validateTrip);$('#import-summary').textContent=`${pendingImport.length} trip${pendingImport.length===1?'':'s'} ready to add.`;$('#import-preview').innerHTML=pendingImport.map(t=>`<li><strong>${esc(t.name)} · ${esc(t.country)}</strong><br>${t.places.length} places · ${esc(t.timeZone)}<ul>${t.places.map(p=>`<li>${esc(p.name)}</li>`).join('')}</ul></li>`).join('');$('#import-error').textContent='';if(!$('#import-dialog').open)$('#import-dialog').showModal();}
$('#import-file').addEventListener('change',async event=>{try{const f=event.target.files[0];if(!f)return;if(f.size>3000000)throw new Error('This backup file is too large.');previewImport(importPayload(JSON.parse(await f.text())));}catch(e){$('#place-error').textContent=e.message;}finally{event.target.value='';}});
$('#confirm-import').addEventListener('click',()=>{try{if(!pendingImport)return;commit(addImportedTrips(state,pendingImport,()=>crypto.randomUUID()));pendingImport=null;renderPlaces();resetPlaceForm();$('#import-dialog').close();$('#status').textContent='Your imported trips are ready.';if(/^#(?:trip|places)=/.test(location.hash))history.replaceState(null,'',location.pathname+location.search);}catch(e){$('#import-error').textContent=e.message;}});
function readSharedLink(){try{const incoming=importHash(location.hash);if(incoming)previewImport(incoming);}catch(e){$('#status').textContent=e.message;}}
document.querySelectorAll('.close-dialog').forEach(el=>el.addEventListener('click',()=>el.closest('dialog').close()));$('#help-button').addEventListener('click',()=>$('#help-dialog').showModal());
function clock(){const time=new Intl.DateTimeFormat('en-GB',{timeZone:trip().timeZone,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());$('#clock').textContent=`${time} · ${trip().timeZone.split('/').at(-1).replaceAll('_',' ')}`;}
function connection(){$('#offline-note').hidden=navigator.onLine;}
window.addEventListener('online',connection);window.addEventListener('offline',connection);window.addEventListener('hashchange',readSharedLink);document.addEventListener('visibilitychange',()=>{if(!document.hidden)clock();});
render();clock();connection();setInterval(clock,30000);readSharedLink();
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
