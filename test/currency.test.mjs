import test from 'node:test';
import assert from 'node:assert/strict';
import {currencyForTrip, validateRate, pesoValue} from '../public/currency.js';
import {initialState, validateTrip, encodeTrip, decodeTrip, importPayload} from '../public/trips.js';
import {createRateService} from '../rates.mjs';
const sample = {base:'TWD', quote:'PHP', date:'2026-09-29', rate:1.9731};
test('Trip currencies are suggested, overrides win, unknown countries require a choice', () => {
  for (const [country, currency] of [['Taiwan','TWD'], ['South Korea','KRW'], ['Japan','JPY'], ['Philippines','PHP'], ['France','EUR']]) assert.equal(currencyForTrip({country}), currency);
  assert.equal(currencyForTrip({country:' taiwan '}), 'TWD');
  assert.equal(currencyForTrip({country:'Taiwan', currency:'USD'}), 'USD');
  assert.equal(currencyForTrip({country:'Unknown country'}), '');
});
test('Currency preferences survive sharing and backups without changing legacy trips', () => {
  const original = initialState().trips[0];
  assert.equal(Object.hasOwn(validateTrip(original), 'currency'), false);
  const changed = validateTrip({...original, currency:'KRW'});
  assert.equal(decodeTrip(encodeTrip(changed)).currency, 'KRW');
  assert.equal(importPayload({version:2, trip:changed})[0].currency, 'KRW');
  assert.throws(() => validateTrip({...original, currency:'../bad'}));
});
test('Conversion uses the full rate and handles zero, decimals, blank and invalid input', () => {
  assert.equal(pesoValue('100', 1.9731), 197.31);
  assert.equal(pesoValue('10000', .04671), 467.1);
  assert.equal(pesoValue('0', 1.9731), 0);
  assert.equal(pesoValue('12.50', 2), 25);
  assert.equal(pesoValue('', 2), null);
  for (const amount of ['-1','NaN','Infinity','1000000001']) assert.throws(() => pesoValue(amount, 2));
});
test('Malformed, wrong-pair, impossible-date and non-positive rates are rejected', () => {
  assert.deepEqual(validateRate(sample, 'TWD'), sample);
  for (const change of [{quote:'USD'}, {base:'KRW'}, {date:'2026-02-30'}, {date:'not a date'}, {rate:'2'}, {rate:NaN}, {rate:-1}, {rate:0}]) assert.throws(() => validateRate({...sample, ...change}, 'TWD'));
});
test('Provider calls are cached and only the currency pair is forwarded', async () => {
  let calls = 0;
  const service = createRateService(async (url, options) => {
    calls++; assert.equal(url, 'https://api.frankfurter.dev/v2/rate/twd/php'); assert.ok(options.signal);
    return {ok:true, json:async () => sample};
  });
  assert.equal((await service('TWD')).rate, sample.rate);
  await service('TWD'); assert.equal(calls, 1);
  await assert.rejects(service('../../evil'));
  assert.equal((await service('PHP')).rate, 1); assert.equal(calls, 1);
});
test('Concurrent requests for the same pair share one provider request', async () => {
  let resolve, calls = 0;
  const service = createRateService(() => { calls++; return new Promise(done => { resolve = done; }); });
  const one = service('TWD'), two = service('TWD');
  resolve({ok:true, json:async () => sample});
  assert.deepEqual(await one, await two); assert.equal(calls, 1);
});
test('A failed refresh preserves the original rate date and timestamp and backs off', async () => {
  let now = Date.now(), failed = false, calls = 0;
  const service = createRateService(async () => { calls++; if (failed) throw Error('Network unavailable'); return {ok:true, json:async () => sample}; }, () => now);
  const first = await service('TWD'); now += 7 * 3600000; failed = true;
  const fallback = await service('TWD');
  assert.equal(fallback.stale, true); assert.equal(fallback.date, first.date); assert.equal(fallback.fetchedAt, first.fetchedAt);
  await service('TWD'); assert.equal(calls, 2);
});
test('No saved rate means a failure, never a made-up conversion', async () => {
  let calls = 0;
  const service = createRateService(async () => { calls++; return {ok:false}; });
  await assert.rejects(service('KRW')); await assert.rejects(service('KRW')); assert.equal(calls, 1);
});
