import {CURRENCIES, validateRate} from './public/currency.js';
export function createRateService(fetchRate = fetch, now = Date.now) {
  const cache = new Map(), pending = new Map(), failures = new Map();
  return async function getRate(base) {
    if (!CURRENCIES.includes(base)) throw new Error('Unsupported currency.');
    if (base === 'PHP') return {base, quote:'PHP', rate:1, date:new Date(now()).toISOString().slice(0,10), fetchedAt:now(), stale:false};
    const saved = cache.get(base);
    if (saved && now() - saved.fetchedAt < 6 * 3600000) return {...saved, stale:false};
    if (failures.has(base) && now() - failures.get(base) < 60000) {
      if (saved) return {...saved, stale:true};
      throw new Error('Rates are temporarily unavailable. Try again shortly.');
    }
    if (pending.has(base)) return pending.get(base);
    const request = (async () => {
      try {
        const response = await fetchRate(`https://api.frankfurter.dev/v2/rate/${base.toLowerCase()}/php`, {signal:AbortSignal.timeout(8000)});
        if (!response.ok) throw new Error('Rates are temporarily unavailable for this currency.');
        const rate = {...validateRate(await response.json(), base), fetchedAt:now()};
        cache.set(base, rate); failures.delete(base);
        return {...rate, stale:false};
      } catch {
        failures.set(base, now());
        if (saved) return {...saved, stale:true};
        throw new Error('Rates are temporarily unavailable for this currency. Try again later.');
      } finally { pending.delete(base); }
    })();
    pending.set(base, request);
    return request;
  };
}
