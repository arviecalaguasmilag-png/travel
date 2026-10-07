import test from 'node:test';
import assert from 'node:assert/strict';
import {searchPlaces, restorePlace} from '../public/place-actions.js';
import {initialState} from '../public/trips.js';
test('Search matches local names, addresses, accents and multiple terms', () => {
  const places = [{id:'cafe', name:'Café Central', localName:'咖啡館', address:'Taipei, Taiwan'}];
  for (const query of ['cafe', '咖啡', 'taiwan', 'CENTRAL taipei', '']) assert.deepEqual(searchPlaces(places, query), places);
  assert.deepEqual(searchPlaces(places, 'Japan'), []);
});
test('Undo restores the correct trip and original position after switching trips', () => {
  const initial = initialState(), place = initial.trips[0].places[2];
  const japan = {id:'japan', name:'Japan', country:'Japan', timeZone:'Asia/Tokyo', places:[]};
  const state = {...initial, activeTripId:'japan', trips:[{...initial.trips[0], places:initial.trips[0].places.filter(p => p.id !== place.id)}, japan]};
  const restored = restorePlace(state, {tripId:'taiwan', place, index:2});
  assert.deepEqual(restored.trips[0].places, initial.trips[0].places);
  assert.deepEqual(restored.trips[1], japan); assert.equal(restored.activeTripId, 'japan');
  assert.equal(state.trips[0].places.length, 8);
});
test('Undo does not duplicate an already restored place', () => {
  const state = initialState();
  assert.equal(restorePlace(state, {tripId:'taiwan', place:state.trips[0].places[0], index:0}), state);
});
