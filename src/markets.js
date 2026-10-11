// Markets decide currency, VAT, default language and number/date conventions.
// Language is chosen separately (EN, NL, DA, DE), so "DK market in English" is a valid test combination.
const MARKETS = {
  NL: { code: 'NL', name: 'Nederland',   defaultLang: 'nl', currency: 'EUR', vatRate: 0.21, color: '#E3701B' },
  BE: { code: 'BE', name: 'België',      defaultLang: 'nl', currency: 'EUR', vatRate: 0.21, color: '#D4A900' },
  DK: { code: 'DK', name: 'Danmark',     defaultLang: 'da', currency: 'DKK', vatRate: 0.25, color: '#C8102E' },
  DE: { code: 'DE', name: 'Deutschland', defaultLang: 'de', currency: 'EUR', vatRate: 0.19, color: '#3B3B3B' },
};
const LANGUAGES = { en: 'English', nl: 'Nederlands', da: 'Dansk', de: 'Deutsch' };

const envDefault = String(process.env.DEFAULT_MARKET || 'NL').toUpperCase();
const DEFAULT_MARKET = MARKETS[envDefault] ? envDefault : 'NL';

const getMarket = (code) => MARKETS[String(code || '').toUpperCase()] || null;
const getLang = (code) => (LANGUAGES[String(code || '').toLowerCase()] ? String(code).toLowerCase() : null);

// BCP-47 locale for formatting: language + market region, e.g. nl-BE, en-DK, da-DK.
const localeFor = (lang, market) => `${lang}-${market.code}`;

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function calcVat(net, rate) {
  const n = round2(net);
  const vat = round2(n * rate);
  return { net: n, vat, gross: round2(n + vat) };
}

function formatters(locale, market) {
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: market.currency });
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const dateTime = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  const pct = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  return {
    money: (v) => money.format(v),
    date: (iso) => (iso ? date.format(new Date(iso + 'T12:00:00Z')) : ''),
    dateTime: (iso) => dateTime.format(new Date(iso)),
    percent: (r) => pct.format(r),
    num: (v) => num.format(v),
  };
}

module.exports = { MARKETS, LANGUAGES, DEFAULT_MARKET, getMarket, getLang, localeFor, calcVat, round2, formatters };
