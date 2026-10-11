const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const cfg = require('./src/config');
const db = require('./src/db');
const { seed } = require('./src/seed');
const { MARKETS, DEFAULT_MARKET, getMarket, getLang, localeFor, formatters } = require('./src/markets');
const { resolveFlags, parseFlagQuery } = require('./src/flags');
const { translator } = require('./src/i18n');
const store = require('./src/store');
const { notFoundPage } = require('./src/views/admin');
const { version } = require('./package.json');

// Load persisted data, or create the demo data on first start.
if (db.exists()) {
  db.load();
  console.log(`[data] loaded from ${cfg.DATA_DIR}`);
} else {
  seed();
  console.log(`[data] first start: demo data written to ${cfg.DATA_DIR}`);
}

if (cfg.PROD && cfg.SESSION_SECRET === 'dev-only-secret') console.warn('[warn] SESSION_SECRET is not set.');
if (cfg.PROD && !cfg.TEST_API_TOKEN) console.warn('[warn] TEST_API_TOKEN is not set; /api write endpoints are disabled.');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieSession({ name: 'pl', keys: [cfg.SESSION_SECRET], maxAge: 8 * 3600 * 1000, sameSite: 'lax', secure: cfg.PROD, httpOnly: true }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: cfg.PROD ? '1h' : 0 }));

// Request context. Precedence: ?market= / ?lang= deep links > session > defaults.
// Switching market resets language to that market's default; ?lang= then overrides it.
app.use((req, res, next) => {
  // Re-validate the session user on every request, so deactivated or deleted users are signed out.
  if (req.session.user) {
    const u = store.getUser(req.session.user.id);
    if (!u || !u.active) { const { market, lang } = req.session; req.session = { market, lang }; }
  }
  const user = req.session.user || null;
  if (req.query.market && getMarket(req.query.market) && user?.role !== 'vendor') {
    const code = getMarket(req.query.market).code;
    if (req.session.market !== code) delete req.session.lang;
    req.session.market = code;
  }
  if (req.query.lang && getLang(req.query.lang)) req.session.lang = getLang(req.query.lang);
  if (cfg.ALLOW_FLAG_OVERRIDES) {
    const { reset, overrides } = parseFlagQuery(req.query);
    if (reset) req.session.flags = {};
    else if (Object.keys(overrides).length) req.session.flags = { ...(req.session.flags || {}), ...overrides };
  }
  const market = getMarket(req.session.market) || MARKETS[DEFAULT_MARKET];
  const lang = getLang(req.session.lang) || market.defaultLang;
  const locale = localeFor(lang, market);
  req.ctx = { market, lang, locale, flags: resolveFlags(market.code, req.session.flags || {}), t: translator(lang), fmt: formatters(locale, market), user, store, version };
  res.set('X-Market', market.code);
  res.set('Content-Language', lang);
  next();
});

app.use('/api', require('./src/routes/api')({ version }));
app.use('/admin', require('./src/routes/admin')());
app.use('/', require('./src/routes/ui')());

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not found' });
  res.status(404).send(notFoundPage(req.ctx));
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  if (req.path.startsWith('/api/')) return res.status(500).json({ error: 'internal error' });
  res.status(500).send('Internal error');
});

if (require.main === module) {
  app.listen(cfg.PORT, () => console.log(`${cfg.APP_NAME} v${version} on http://localhost:${cfg.PORT} (default market ${DEFAULT_MARKET})`));
}

module.exports = app;
