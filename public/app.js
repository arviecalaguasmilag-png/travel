import {validatePlaces, directionsLink} from './links.js';
import {STORAGE_KEY, LEGACY_KEY, initialState, validateTrip, validateState, encodeTrip, importPayload, importHash, addImportedTrips} from './trips.js';
import {CURRENCIES, currencyName, currencyForTrip, validateRate, pesoValue, formatPeso, oldRate} from './currency.js';
import {searchPlaces, restorePlace} from './place-actions.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
let state = initialState(), pendingImport = null, storageReadFailed = false;
try {
  const saved = localStorage.getItem(STORAGE_KEY), legacy = localStorage.getItem(LEGACY_KEY);
  state = saved ? validateState(JSON.parse(saved)) : initialState(legacy ? JSON.parse(legacy) : undefined);
  if (!saved) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
} catch {
  storageReadFailed = true;
  storageWarning('Saved data could not be loaded. Your original browser data has been kept; changes are temporary until storage is available.');
}
const trip = () => state.trips.find(t => t.id === state.activeTripId);
const getPlace = id => trip().places.find(p => p.id === id);
const selections = new Map(), removals = [];
let pickerTarget = 'destination', placeReturn = 'route';
function storageWarning(text) { $('#storage-note').textContent = text; $('#storage-note').hidden = false; }
function commit(next) {
  state = validateState(next);
  if (!storageReadFailed) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); $('#storage-note').hidden = true; }
    catch { storageWarning('This browser cannot save changes permanently. Back up all trips before closing it.'); }
  }
  render();
}
function selection() {
  const t = trip(), previous = selections.get(t.id);
  const current = {
    origin:previous?.origin === 'current' || getPlace(previous?.origin) ? previous.origin : t.places.length > 1 ? t.places[0].id : 'current',
    destination:getPlace(previous?.destination) ? previous.destination : t.places[1]?.id || t.places[0]?.id || ''
  };
  selections.set(t.id, current);
  return current;
}
const destination = () => getPlace(selection().destination);
function render() {
  const t = trip();
  $('#trip-select').innerHTML = state.trips.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
  $('#trip-select').value = t.id;
  $('#country-label').textContent = t.country;
  $('#places-count').textContent = t.places.length;
  $('#empty-note').hidden = t.places.length > 0;
  $('#copy-address').disabled = !t.places.length;
  $('#swap').disabled = !t.places.length;
  $('#place-address').placeholder = `Place, city, ${t.country}`;
  $('#quick-places').innerHTML = t.places.slice(0,3).map(p => `<button class="quick-place" data-destination="${esc(p.id)}" aria-label="Directions to ${esc(p.name)}">${icon('pin')}<span><strong>${esc(p.name)}</strong><small>${esc(p.localName || p.address)}</small></span>${icon('arrow')}</button>`).join('') || '<p class="small-muted">Your favorite discoveries will feel right at home here. Add your first place above.</p>';
  updateRoute(); clock(); syncCurrency();
}
function updateRoute() {
  const current = selection(), from = getPlace(current.origin), to = getPlace(current.destination);
  const mode = $('input[name=mode]:checked').value;
  $('#origin-name').textContent = from?.name || 'My location';
  $('#destination-name').textContent = to?.name || 'Choose a destination';
  $('#origin-caption').textContent = from ? from.localName || from.address : 'Google Maps will find your location';
  $('#destination-caption').textContent = to ? to.localName || to.address : 'Search saved places or add a new one';
  $('#directions-link').href = directionsLink(from, to, mode);
  $('#directions-link').setAttribute('aria-disabled', String(!to || from?.id === to.id));
  $('#directions-hint').textContent = {transit:'Bus and train departures, service numbers, and stops in Google Maps.', driving:'Driving routes and estimated travel time in Google Maps.', walking:'Walking routes and estimated travel time in Google Maps.'}[mode];
  $('#status').textContent = to && from?.id === to.id ? 'Choose a different starting point or destination.' : '';
}
function showDialog(id, focus) {
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  $(id).showModal();
  if (focus) $(focus).focus();
}
function chooseDestination(id) {
  selections.set(trip().id, {...selection(), destination:id});
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  updateRoute(); $('#directions-link').focus();
}
$('#trip-select').addEventListener('change', () => commit({...state, activeTripId:$('#trip-select').value}));
document.querySelectorAll('input[name=mode]').forEach(el => el.addEventListener('change', updateRoute));
$('#swap').addEventListener('click', () => {
  const current = selection();
  if (current.origin === 'current') { $('#status').textContent = 'Choose a saved starting point before swapping.'; return; }
  selections.set(trip().id, {origin:current.destination, destination:current.origin}); updateRoute();
});
$('#use-location').addEventListener('click', () => { selections.set(trip().id, {...selection(), origin:'current'}); updateRoute(); });
$('#directions-link').addEventListener('click', event => {
  if (!destination() || selection().origin === selection().destination) {
    event.preventDefault(); $('#status').textContent = !destination() ? 'Add or choose a destination first.' : 'Choose two different places.';
  }
});
$('#quick-places').addEventListener('click', event => { const button = event.target.closest('[data-destination]'); if (button) chooseDestination(button.dataset.destination); });
async function copyText(text, success, target = '#status') {
  try { await navigator.clipboard.writeText(text); $(target).textContent = success; }
  catch { $('#copy-text').value = text; showDialog('#copy-dialog', '#copy-text'); $('#copy-text').select(); }
}
$('#copy-address').addEventListener('click', () => {
  const place = destination();
  if (place) copyText([place.localName, place.name, place.address].filter(Boolean).join('\n'), 'Destination copied. Share it or show it to a local.');
});

// A native dialog makes place search usable with touch, keyboard, and screen readers.
function openPicker(target) {
  pickerTarget = target;
  $('#picker-title').textContent = target === 'origin' ? 'Choose a starting point' : 'Choose a destination';
  $('#picker-search').value = ''; renderPicker(); showDialog('#picker-dialog', '#picker-search');
}
function renderPicker() {
  const query = $('#picker-search').value, places = searchPlaces(trip().places, query);
  const current = pickerTarget === 'origin' && (!query.trim() || 'my location'.includes(query.toLowerCase().trim()));
  $('#picker-count').textContent = `${places.length} saved place${places.length === 1 ? '' : 's'}${query.trim() ? ' found' : ''}`;
  $('#picker-results').innerHTML = (current ? '<button class="picker-option" data-place="current"><strong>◎ My location</strong><small>Let Google Maps find your starting point</small></button>' : '') + places.map(p => `<button class="picker-option" data-place="${esc(p.id)}"><strong>${esc(p.name)}${p.localName ? ' · ' + esc(p.localName) : ''}</strong><small>${esc(p.address)}</small></button>`).join('') + (!places.length && !current ? '<p class="empty-state">No places found. Try another name or add a new place.</p>' : '');
}
$('#origin').addEventListener('click', () => openPicker('origin'));
$('#destination').addEventListener('click', () => openPicker('destination'));
$('#picker-search').addEventListener('input', renderPicker);
$('#picker-results').addEventListener('click', event => {
  const button = event.target.closest('[data-place]'); if (!button) return;
  selections.set(trip().id, {...selection(), [pickerTarget]:button.dataset.place});
  $('#picker-dialog').close(); updateRoute(); $('#' + pickerTarget).focus();
});

const zones = [...new Set(['UTC', 'Asia/Taipei', 'Asia/Tokyo', ...Intl.supportedValuesOf('timeZone')])].sort();
const countryZones = {taiwan:'Asia/Taipei', japan:'Asia/Tokyo', 'south korea':'Asia/Seoul', philippines:'Asia/Manila', singapore:'Asia/Singapore', thailand:'Asia/Bangkok', vietnam:'Asia/Ho_Chi_Minh', malaysia:'Asia/Kuala_Lumpur', 'hong kong':'Asia/Hong_Kong', 'united kingdom':'Europe/London', france:'Europe/Paris', italy:'Europe/Rome', germany:'Europe/Berlin', 'new zealand':'Pacific/Auckland'};
function zoneOptions(selected) {
  $('#trip-timezone').innerHTML = [...new Set([...zones, selected])].sort().map(z => `<option value="${esc(z)}">${esc(z.replaceAll('_',' '))}</option>`).join('');
  $('#trip-timezone').value = selected;
}
function editTrip(existing) {
  $('#trip-form').reset(); $('#trip-id').value = existing?.id || ''; $('#trip-title').textContent = existing ? 'Edit trip' : 'New trip';
  $('#trip-name').value = existing?.name || ''; $('#trip-country').value = existing?.country || '';
  zoneOptions(existing?.timeZone || 'UTC'); $('#trip-error').textContent = ''; showDialog('#trip-dialog', '#trip-name');
}
$('#new-trip').addEventListener('click', () => editTrip(null));
$('#edit-trip').addEventListener('click', () => editTrip(trip()));
$('#trip-country').addEventListener('change', () => {
  if (!$('#trip-id').value) zoneOptions(countryZones[$('#trip-country').value.trim().toLowerCase()] || 'UTC');
});
$('#trip-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const id = $('#trip-id').value || crypto.randomUUID(), existing = state.trips.find(t => t.id === id), country = $('#trip-country').value.trim();
    const next = validateTrip({id, name:$('#trip-name').value, country, timeZone:$('#trip-timezone').value, places:existing?.places || [], ...(existing?.currency && existing.country.toLowerCase() === country.toLowerCase() ? {currency:existing.currency} : {})});
    commit({...state, activeTripId:id, trips:existing ? state.trips.map(t => t.id === id ? next : t) : [...state.trips, next]});
    $('#trip-dialog').close(); $('#trip-select').focus();
  } catch (error) { $('#trip-error').textContent = error.message; }
});

function savePlaces(places) { commit({...state, trips:state.trips.map(t => t.id === state.activeTripId ? {...t, places:validatePlaces(places)} : t)}); }
function renderPlaces() {
  $('#places-context').textContent = `${trip().name} · ${trip().country}. Saved on this device.`;
  const places = searchPlaces(trip().places, $('#places-search').value);
  $('#saved-places').innerHTML = places.map(p => `<li><div class="place-row"><div class="place-details"><strong>${esc(p.name)}</strong>${p.localName ? `<span class="local-name">${esc(p.localName)}</span>` : ''}<small>${esc(p.address)}</small></div><button class="quiet" data-use="${esc(p.id)}" aria-label="Use ${esc(p.name)} as destination">Go ${icon('arrow')}</button></div><div class="place-actions"><button class="text-button" data-edit="${esc(p.id)}" aria-label="Edit ${esc(p.name)}">Edit</button><button class="text-button remove-place" data-remove="${esc(p.id)}" aria-label="Remove ${esc(p.name)}">Remove</button></div></li>`).join('');
  $('#places-empty').hidden = places.length > 0;
  $('#places-empty').textContent = trip().places.length ? 'No matching places. Try a different search.' : 'Start with your hotel, a station, or somewhere you can’t wait to visit.';
  renderUndo();
}
function openPlaces() { $('#places-search').value = ''; $('#place-error').textContent = ''; renderPlaces(); showDialog('#places-dialog', '#places-search'); }
$('#places-button').addEventListener('click', openPlaces); $('#all-places').addEventListener('click', openPlaces);
$('#places-search').addEventListener('input', renderPlaces);
$('#saved-places').addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.use) chooseDestination(button.dataset.use);
  if (button.dataset.edit) openPlace(getPlace(button.dataset.edit), 'places');
  if (button.dataset.remove) {
    const index = trip().places.findIndex(p => p.id === button.dataset.remove);
    const removal = {tripId:trip().id, tripName:trip().name, index, place:trip().places[index]};
    savePlaces(trip().places.filter(p => p.id !== button.dataset.remove)); removals.push(removal);
    renderPlaces(); $('#places-undo-button').focus();
  }
});
function renderUndo() {
  const removal = removals.at(-1);
  $('#undo-notice').hidden = !removal; $('#places-undo').hidden = !removal;
  if (removal) { const message = `${removal.place.name} removed from ${removal.tripName}.`; $('#undo-message').textContent = message; $('#places-undo-message').textContent = message; }
}
function undoRemoval() {
  const removal = removals.at(-1); if (!removal) return;
  try {
    commit(restorePlace(state, removal)); removals.pop(); renderPlaces();
    $('#place-error').textContent = `${removal.place.name} restored to ${removal.tripName}.`; $('#status').textContent = `${removal.place.name} restored.`;
    if ($('#places-dialog').open) ($('#saved-places').querySelector(`[data-edit="${removal.place.id}"]`) || $('#places-search')).focus();
    else $('#places-button').focus();
  }
  catch (error) { $('#place-error').textContent = error.message; $('#status').textContent = error.message; }
}
$('#undo-remove').addEventListener('click', undoRemoval); $('#places-undo-button').addEventListener('click', undoRemoval);
$('#dismiss-undo').addEventListener('click', () => { removals.length = 0; renderUndo(); });
function openPlace(existing, returnTo = 'route') {
  placeReturn = returnTo; $('#place-form').reset(); $('#place-id').value = existing?.id || '';
  $('#place-form-title').textContent = existing ? 'Edit place' : 'Add a place';
  $('#place-name').value = existing?.name || ''; $('#place-address').value = existing?.address || ''; $('#place-local').value = existing?.localName || '';
  $('#place-form-error').textContent = ''; showDialog('#place-dialog', '#place-name');
}
function cancelPlace() {
  $('#place-dialog').close();
  if (placeReturn === 'places') { renderPlaces(); showDialog('#places-dialog', '#new-place'); }
  else if (placeReturn === 'picker') openPicker(pickerTarget);
  else $('#add-destination').focus();
}
$('#new-place').addEventListener('click', () => openPlace(null, 'places'));
$('#add-destination').addEventListener('click', () => openPlace(null));
$('#picker-add').addEventListener('click', () => openPlace(null, 'picker'));
$('#cancel-place-edit').addEventListener('click', cancelPlace);
$('#place-dialog').addEventListener('cancel', event => { event.preventDefault(); cancelPlace(); });
$('#place-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const id = $('#place-id').value || crypto.randomUUID();
    const place = {id, name:$('#place-name').value.trim(), address:$('#place-address').value.trim(), localName:$('#place-local').value.trim()};
    savePlaces(trip().places.some(p => p.id === id) ? trip().places.map(p => p.id === id ? place : p) : [...trip().places, place]);
    $('#place-dialog').close();
    if (placeReturn === 'places') { renderPlaces(); showDialog('#places-dialog', '#new-place'); $('#place-error').textContent = 'Place saved on this device.'; }
    else { const target = placeReturn === 'picker' ? pickerTarget : 'destination'; selections.set(trip().id, {...selection(), [target]:id}); updateRoute(); $('#' + target).focus(); $('#status').textContent = 'Place saved and selected.'; }
  } catch (error) { $('#place-form-error').textContent = error.message; }
});

// Only a currency code leaves the browser; prices and trip addresses stay local.
const RATE_KEY = 'travel-peso-rates-v1';
let currentBase, currentRate = null, rateRequest = 0, rateCache = {}, currencyContext;
try { const saved = JSON.parse(localStorage.getItem(RATE_KEY) || '{}'); if (saved && typeof saved === 'object' && !Array.isArray(saved)) rateCache = saved; } catch { /* A rate can always be fetched again. */ }
$('#currency-select').innerHTML = '<option value="">Choose a currency</option>' + CURRENCIES.map(code => `<option value="${code}">${code} · ${esc(currencyName(code))}</option>`).join('');
function cachedRate(base) {
  try { const data = rateCache[base]; const valid = validateRate(data, base); if (!Number.isFinite(data.fetchedAt) || data.fetchedAt > Date.now()) return null; return {...valid, fetchedAt:data.fetchedAt, stale:true}; } catch { return null; }
}
function syncCurrency() {
  const base = currencyForTrip(trip()), context = `${trip().id}:${trip().country}:${base}`;
  if (context === currencyContext) return;
  currencyContext = context; currentBase = base; $('#currency-select').value = base; loadRate();
}
function paintConversion() {
  $('#currency-result').textContent = '—'; $('#currency-error').textContent = '';
  const input = $('#currency-amount');
  if (input.validity.badInput || !input.checkValidity()) { $('#currency-error').textContent = 'Enter an amount between 0 and 1,000,000,000.'; return; }
  if (!currentRate) return;
  try { const value = pesoValue(input.value, currentRate.rate); if (value !== null) $('#currency-result').textContent = formatPeso(value); }
  catch (error) { $('#currency-error').textContent = error.message; }
}
function paintRate(status) {
  const rate = currentRate;
  $('#rate-detail').textContent = rate ? `1 ${rate.base} ≈ ₱${new Intl.NumberFormat('en-PH', {maximumFractionDigits:6}).format(rate.rate)} · Rate date: ${new Intl.DateTimeFormat('en', {day:'numeric', month:'short', year:'numeric', timeZone:'UTC'}).format(new Date(rate.date + 'T00:00:00Z'))}` : '';
  $('#rate-status').textContent = rate && oldRate(rate.date) ? `Older saved rate · ${status}` : status;
  paintConversion();
}
async function loadRate(force = false) {
  const request = ++rateRequest, base = currentBase;
  currentRate = null; $('#currency-symbol').textContent = base; $('#amount-label').textContent = base ? `Amount in ${base}` : 'Amount';
  $('#refresh-rate').disabled = !base; $('#currency-amount').disabled = !base;
  if (!base) { paintRate('Choose the currency used at your destination.'); return; }
  if (base === 'PHP') { currentRate = {base, quote:'PHP', rate:1, date:new Date().toISOString().slice(0,10)}; $('#refresh-rate').disabled = true; paintRate('Already in Philippine pesos'); return; }
  currentRate = cachedRate(base);
  if (!navigator.onLine) { paintRate(currentRate ? 'Offline · saved rate' : 'Offline · no saved rate for this currency'); return; }
  if (!force && currentRate && Date.now() - currentRate.fetchedAt < 6 * 3600000) { paintRate('Saved daily reference rate'); return; }
  paintRate(currentRate ? 'Saved rate · checking for an update…' : 'Getting the latest available rate…');
  $('#refresh-rate').disabled = true;
  try {
    const response = await fetch('/api/rates?base=' + base, {signal:AbortSignal.timeout(10000)});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load a rate.');
    const valid = validateRate(data, base);
    if (!Number.isFinite(data.fetchedAt) || data.fetchedAt > Date.now() + 60000) throw new Error('Invalid rate timestamp.');
    if (request !== rateRequest) return;
    currentRate = {...valid, fetchedAt:data.fetchedAt, stale:!!data.stale}; rateCache[base] = currentRate;
    let saved = true;
    try { localStorage.setItem(RATE_KEY, JSON.stringify(rateCache)); } catch { saved = false; }
    paintRate(data.stale ? 'Update unavailable · saved rate' : saved ? 'Daily reference rate' : 'Rate loaded · offline saving unavailable');
  } catch {
    if (request !== rateRequest) return;
    paintRate(currentRate ? 'Update unavailable · saved rate' : 'Rate unavailable. Check your connection or try another currency.');
  } finally { if (request === rateRequest) $('#refresh-rate').disabled = false; }
}
$('#currency-select').addEventListener('change', () => {
  const base = $('#currency-select').value;
  if (!base) { currentBase = ''; loadRate(); return; }
  currencyContext = undefined;
  commit({...state, trips:state.trips.map(t => t.id === state.activeTripId ? {...t, currency:base} : t)});
});
$('#currency-amount').addEventListener('input', paintConversion);
$('#refresh-rate').addEventListener('click', () => loadRate(true));

$('#tools-button').addEventListener('click', () => { $('#tools-status').textContent = ''; showDialog('#tools-dialog'); });
$('#share-trip').addEventListener('click', async () => {
  const url = new URL(location.pathname, location.origin); url.hash = 'trip=' + encodeTrip(trip());
  if (url.href.length > 12000) { $('#tools-status').textContent = 'This trip is too long for a reliable link. Send a backup file instead.'; return; }
  if (navigator.share) { try { await navigator.share({title:trip().name, text:'Open this link to copy our trip and places.', url:url.href}); return; } catch (error) { if (error.name === 'AbortError') return; } }
  await copyText(url.href, 'Link copied. It includes this trip’s settings, place names, and addresses.', '#tools-status');
});
$('#export-trips').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], {type:'application/json'})), anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'travel-trips.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('#tools-status').textContent = 'Backup downloaded. It contains every trip and its places.';
});
function previewImport(trips) {
  pendingImport = trips.map(validateTrip);
  $('#import-summary').textContent = `${pendingImport.length} trip${pendingImport.length === 1 ? '' : 's'} ready to add.`;
  $('#import-preview').innerHTML = pendingImport.map(t => `<li><strong>${esc(t.name)} · ${esc(t.country)}</strong><br>${t.places.length} places · ${esc(t.timeZone)}<ul>${t.places.map(p => `<li>${esc(p.name)}</li>`).join('')}</ul></li>`).join('');
  $('#import-error').textContent = ''; showDialog('#import-dialog');
}
$('#import-file').addEventListener('change', async event => {
  try { const file = event.target.files[0]; if (!file) return; if (file.size > 3000000) throw new Error('This backup file is too large.'); previewImport(importPayload(JSON.parse(await file.text()))); }
  catch (error) { $('#tools-status').textContent = error.message; }
  finally { event.target.value = ''; }
});
$('#confirm-import').addEventListener('click', () => {
  try {
    if (!pendingImport) return;
    commit(addImportedTrips(state, pendingImport, () => crypto.randomUUID())); pendingImport = null;
    $('#import-dialog').close(); $('#trip-select').focus(); $('#status').textContent = 'Your imported trips are ready.';
    if (/^#(?:trip|places)=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  } catch (error) { $('#import-error').textContent = error.message; }
});
function readSharedLink() { try { const incoming = importHash(location.hash); if (incoming) previewImport(incoming); } catch (error) { $('#status').textContent = error.message; } }
document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => { if (button.closest('dialog').id === 'place-dialog') cancelPlace(); else button.closest('dialog').close(); }));
$('#help-button').addEventListener('click', () => showDialog('#help-dialog'));
function clock() { $('#clock').textContent = new Intl.DateTimeFormat('en-GB', {timeZone:trip().timeZone, hour:'2-digit', minute:'2-digit', hour12:false}).format(new Date()) + ' · ' + trip().timeZone.split('/').at(-1).replaceAll('_', ' '); }
function connection() { $('#offline-note').hidden = navigator.onLine; loadRate(); }
window.addEventListener('online', connection); window.addEventListener('offline', connection);
window.addEventListener('hashchange', readSharedLink);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { clock(); loadRate(); } });
render(); $('#offline-note').hidden = navigator.onLine; setInterval(clock, 30000); readSharedLink();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
