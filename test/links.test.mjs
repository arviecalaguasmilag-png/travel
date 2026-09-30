import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_PLACES} from '../public/places.js';
import {validatePlaces,directionsLink,encodePlaces,decodePlaces} from '../public/links.js';
test('Shared places preserve Chinese text and round-trip without extra fields',()=>{assert.deepEqual(decodePlaces(encodePlaces(DEFAULT_PLACES)),validatePlaces(DEFAULT_PLACES));});
test('Malformed, oversized, and duplicate place lists are rejected',()=>{assert.throws(()=>decodePlaces('not-a-valid-list'));assert.throws(()=>decodePlaces('a'.repeat(140001)));assert.throws(()=>validatePlaces([DEFAULT_PLACES[0],DEFAULT_PLACES[0]]));assert.throws(()=>validatePlaces([{id:'x',name:'X',address:'ab',localName:''},DEFAULT_PLACES[0]]));});
test('Google directions contain the selected origin, destination and mode',()=>{const u=new URL(directionsLink(DEFAULT_PLACES[0],DEFAULT_PLACES[1],'transit'));assert.equal(u.origin,'https://www.google.com');assert.equal(u.searchParams.get('api'),'1');assert.equal(u.searchParams.get('origin'),DEFAULT_PLACES[0].address);assert.equal(u.searchParams.get('destination'),DEFAULT_PLACES[1].address);assert.equal(u.searchParams.get('travelmode'),'transit');});
test('My location leaves origin for Google Maps to resolve',()=>{const u=new URL(directionsLink(null,DEFAULT_PLACES[0],'walking'));assert.equal(u.searchParams.has('origin'),false);assert.equal(u.searchParams.get('travelmode'),'walking');});
test('Untrusted place text stays inside an encoded destination parameter',()=>{const address='Taipei &travelmode=driving#test';const u=new URL(directionsLink(null,{address},'transit'));assert.equal(u.searchParams.get('destination'),address);assert.equal(u.searchParams.get('travelmode'),'transit');assert.equal(u.hash,'');});
