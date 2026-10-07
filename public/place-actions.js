import {validateState} from './trips.js';
const normalize = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function searchPlaces(places, query) {
  const words = normalize(query.trim()).split(/\s+/).filter(Boolean);
  return places.filter(place => {
    const text = normalize([place.name, place.localName, place.address].join(' '));
    return words.every(word => text.includes(word));
  });
}
export function restorePlace(state, removal) {
  const target = state.trips.find(trip => trip.id === removal.tripId);
  if (!target) throw new Error('The original trip is no longer available.');
  if (target.places.some(place => place.id === removal.place.id)) return state;
  const places = [...target.places];
  places.splice(Math.min(removal.index, places.length), 0, removal.place);
  return validateState({...state, trips:state.trips.map(trip => trip.id === target.id ? {...trip, places} : trip)});
}
