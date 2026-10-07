// Currency preferences are optional so version-2 trips remain backwards compatible.
export const CURRENCIES = [...new Set(['TWD', 'PHP', ...Intl.supportedValuesOf('currency')])].sort();
const names = new Intl.DisplayNames(['en'], { type: 'currency' });
export const currencyName = code => names.of(code) || code;
const countryCurrency = {
  taiwan:'TWD', japan:'JPY', 'south korea':'KRW', 'republic of korea':'KRW', korea:'KRW',
  philippines:'PHP', singapore:'SGD', thailand:'THB', vietnam:'VND', malaysia:'MYR', indonesia:'IDR',
  'hong kong':'HKD', macau:'MOP', macao:'MOP', china:'CNY', india:'INR', nepal:'NPR',
  'sri lanka':'LKR', cambodia:'KHR', laos:'LAK', myanmar:'MMK', brunei:'BND', bangladesh:'BDT',
  'united kingdom':'GBP', uk:'GBP', 'great britain':'GBP', england:'GBP', scotland:'GBP', wales:'GBP',
  france:'EUR', italy:'EUR', spain:'EUR', germany:'EUR', portugal:'EUR', netherlands:'EUR',
  belgium:'EUR', ireland:'EUR', austria:'EUR', greece:'EUR', finland:'EUR', estonia:'EUR', latvia:'EUR',
  lithuania:'EUR', slovakia:'EUR', slovenia:'EUR', croatia:'EUR', malta:'EUR', cyprus:'EUR',
  luxembourg:'EUR', bulgaria:'EUR', switzerland:'CHF', sweden:'SEK', norway:'NOK', denmark:'DKK',
  poland:'PLN', czechia:'CZK', 'czech republic':'CZK', hungary:'HUF', romania:'RON', iceland:'ISK',
  australia:'AUD', 'new zealand':'NZD', 'united states':'USD', usa:'USD', us:'USD',
  'united states of america':'USD', canada:'CAD', mexico:'MXN', brazil:'BRL', argentina:'ARS',
  chile:'CLP', peru:'PEN', colombia:'COP', 'south africa':'ZAR', egypt:'EGP', morocco:'MAD',
  'united arab emirates':'AED', uae:'AED', 'saudi arabia':'SAR', qatar:'QAR', turkey:'TRY',
  türkiye:'TRY', israel:'ILS', jordan:'JOD', oman:'OMR', bahrain:'BHD', kuwait:'KWD', pakistan:'PKR'
};
export function currencyForTrip(trip) {
  if (CURRENCIES.includes(trip.currency)) return trip.currency;
  return countryCurrency[trip.country.trim().toLowerCase()] || '';
}
export function validateRate(data, base) {
  if (!data || data.base !== base || data.quote !== 'PHP' || typeof data.rate !== 'number' ||
      !Number.isFinite(data.rate) || data.rate <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    throw new Error('The exchange-rate response could not be verified.');
  }
  const date = new Date(data.date + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== data.date || date.getTime() > Date.now() + 86400000) {
    throw new Error('The exchange-rate date could not be verified.');
  }
  return { base, quote:'PHP', rate:data.rate, date:data.date };
}
export function pesoValue(amount, rate) {
  if (typeof amount === 'string' && !amount.trim()) return null;
  const number = Number(amount);
  if (!Number.isFinite(number) || number < 0 || number > 1e9) throw new Error('Enter an amount between 0 and 1,000,000,000.');
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('A valid exchange rate is needed.');
  return number * rate;
}
export const formatPeso = value => new Intl.NumberFormat('en-PH', { style:'currency', currency:'PHP' }).format(value);
export const oldRate = date => Date.now() - Date.parse(date + 'T00:00:00Z') > 4 * 86400000;
