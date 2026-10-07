import {DEFAULT_PLACES} from './places.js';
import {validatePlaces,decodePlaces} from './links.js';
import {CURRENCIES} from './currency.js';
export const STORAGE_KEY='travel-trips-v2';
export const LEGACY_KEY='taiwan-together-free-places-v1';
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9-]{1,64}$/.test(id);
export function validateTrip(input){
  if(!input||!validId(input.id))throw new Error('This trip has an invalid ID.');
  for(const key of ['name','country'])if(typeof input[key]!=='string'||!input[key].trim()||input[key].length>80)throw new Error('Enter a trip name and country (up to 80 characters each).');
  if(typeof input.timeZone!=='string'||input.timeZone.length>80)throw new Error('Choose a valid time zone.');
  try{new Intl.DateTimeFormat('en',{timeZone:input.timeZone});}catch{throw new Error('Choose a valid time zone.');}
  if(input.currency!==undefined&&!CURRENCIES.includes(input.currency))throw new Error('Choose a supported currency.');
  return {id:input.id,name:input.name.trim(),country:input.country.trim(),timeZone:input.timeZone,places:validatePlaces(input.places),...(input.currency?{currency:input.currency}:{})};
}
export function initialState(legacy){return {version:2,activeTripId:'taiwan',trips:[validateTrip({id:'taiwan',name:'Taiwan trip',country:'Taiwan',timeZone:'Asia/Taipei',places:legacy??DEFAULT_PLACES})]};}
export function validateState(input){
  if(input?.version!==2||!Array.isArray(input.trips)||input.trips.length<1||input.trips.length>30)throw new Error('A travel backup must contain between 1 and 30 trips.');
  const trips=input.trips.map(validateTrip);
  if(new Set(trips.map(t=>t.id)).size!==trips.length)throw new Error('This backup contains duplicate trips.');
  return {version:2,activeTripId:trips.some(t=>t.id===input.activeTripId)?input.activeTripId:trips[0].id,trips};
}
export function encodeTrip(trip){const bytes=new TextEncoder().encode(JSON.stringify({version:2,trip:validateTrip(trip)}));return btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
export function decodeTrip(value){
  if(typeof value!=='string'||value.length>140000||!/^[\w-]+$/.test(value))throw new Error('This shared trip link is invalid.');
  try{const raw=atob(value.replaceAll('-','+').replaceAll('_','/'));const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(raw,c=>c.charCodeAt(0))));if(data.version!==2)throw new Error();return validateTrip(data.trip);}
  catch{throw new Error('This shared trip could not be read. Ask for a new link.');}
}
export function importPayload(data){if(data?.version===1&&Array.isArray(data.places))return initialState(data.places).trips;if(data?.version===2&&data.trip)return [validateTrip(data.trip)];return validateState(data).trips;}
export function importHash(hash){if(hash.startsWith('#trip='))return [decodeTrip(hash.slice(6))];if(hash.startsWith('#places='))return initialState(decodePlaces(hash.slice(8))).trips;return null;}
export function addImportedTrips(state,incoming,idFactory){const current=validateState(state),added=incoming.map(t=>validateTrip({...t,id:idFactory()}));return validateState({...current,trips:[...current.trips,...added],activeTripId:added[0]?.id||current.activeTripId});}
