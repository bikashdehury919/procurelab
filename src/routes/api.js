// Test data API. Public: health, config, i18n. Everything else needs the x-test-token header.
const express = require('express');
const store = require('../store');
const db = require('../db');
const { seed } = require('../seed');
const { MARKETS, LANGUAGES, DEFAULT_MARKET, getMarket } = require('../markets');
const { resolveFlags, FLAG_DEFAULTS } = require('../flags');
const { STRINGS, missingKeys } = require('../i18n');
const { WEIGHTS } = require('../insights');
const { acceptFiles, originalName } = require('../uploads');
const { TEST_API_TOKEN, MAX_UPLOAD_MB, ALLOWED_EXTENSIONS, APP_NAME } = require('../config');

const isPositive = (v) => v !== '' && v !== undefined && v !== null && Number.isFinite(Number(v)) && Number(v) > 0;
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !Number.isNaN(Date.parse(v));
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ''));
const s = (v) => (v === undefined || v === null ? '' : String(v));
const publicUser = ({ passwordHash, ...u }) => u;

module.exports = function apiRoutes({ version }) {
  const r = express.Router();

  r.get('/health', (req, res) => res.json({ status: 'ok', app: APP_NAME, version, uptimeSeconds: Math.round(process.uptime()), aiConfigured: !!process.env.ANTHROPIC_API_KEY, dataDir: db.stats().dataDir }));
  r.get('/config', (req, res) => res.json({
    version, defaultMarket: DEFAULT_MARKET, languages: LANGUAGES,
    markets: Object.values(MARKETS).map((m) => ({ ...m, flags: resolveFlags(m.code) })),
    flagDefaults: FLAG_DEFAULTS, scoringWeights: WEIGHTS, expertise: store.EXPERTISE, priorities: store.PRIORITIES, roles: store.ROLES,
    uploads: { maxMb: MAX_UPLOAD_MB, maxFiles: 5, extensions: ALLOWED_EXTENSIONS },
  }));
  r.get('/i18n', (req, res) => res.json({ strings: STRINGS, missing: missingKeys() }));

  r.use((req, res, next) => {
    if (!TEST_API_TOKEN) return res.status(503).json({ error: 'Test API disabled: TEST_API_TOKEN not configured' });
    if (req.get('x-test-token') !== TEST_API_TOKEN) return res.status(401).json({ error: 'Invalid or missing x-test-token' });
    next();
  });

  r.post('/test/reset', (req, res) => { seed(); res.json({ status: 'reset' }); });
  r.get('/stats', (req, res) => res.json(db.stats()));

  // Users
  r.get('/users', (req, res) => res.json(store.listUsers().map(publicUser)));
  r.post('/users', (req, res) => {
    const b = req.body || {};
    const errors = [];
    if (!s(b.name).trim()) errors.push('name is required');
    if (!isEmail(b.email)) errors.push('email must be valid');
    else if (store.getUserByEmail(b.email)) errors.push('email already exists');
    if (!store.ROLES.includes(b.role)) errors.push(`role must be one of ${store.ROLES.join(', ')}`);
    const vendor = b.role === 'vendor' ? store.getVendor(b.vendorId) : null;
    if (b.role === 'vendor' && !vendor) errors.push('vendorId is required for vendor users');
    if (s(b.password).length < 8) errors.push('password must be at least 8 characters');
    const market = vendor ? vendor.market : getMarket(b.market)?.code;
    if (!market) errors.push('market must be one of NL, BE, DK, DE');
    if (errors.length) return res.status(422).json({ errors });
    res.status(201).json(publicUser(store.createUser({ email: b.email, name: b.name, role: b.role, market, vendorId: vendor?.id || null, password: b.password, active: b.active !== false })));
  });
  r.delete('/users/:id', (req, res) => (store.deleteUser(req.params.id) ? res.status(204).end() : res.status(404).json({ error: 'not found' })));

  // Projects and requirements
  r.get('/projects', (req, res) => {
    const m = getMarket(req.query.market);
    if (!m) return res.status(400).json({ error: 'market query param required (NL, BE, DK, DE)' });
    res.json(store.listProjects(m.code, { status: s(req.query.status) }));
  });
  r.post('/projects', (req, res) => {
    const b = req.body || {};
    const m = getMarket(b.market);
    const errors = [];
    if (!m) errors.push('market must be one of NL, BE, DK, DE');
    if (!s(b.name).trim()) errors.push('name is required');
    else if (m && store.projectNameTaken(m.code, b.name)) errors.push('name already exists in this market');
    if (!s(b.owner).trim()) errors.push('owner is required');
    if (!isPositive(b.budget)) errors.push('budget must be > 0');
    if (!isDate(b.startDate) || !isDate(b.endDate)) errors.push('startDate and endDate must be YYYY-MM-DD');
    else if (b.endDate < b.startDate) errors.push('endDate must be on or after startDate');
    if (b.status && !['planning', 'active', 'completed'].includes(b.status)) errors.push('status must be planning, active or completed');
    if (errors.length) return res.status(422).json({ errors });
    res.status(201).json(store.createProject({ market: m.code, name: b.name, description: s(b.description), budget: b.budget, startDate: b.startDate, endDate: b.endDate, owner: b.owner, status: b.status || 'planning' }));
  });
  r.delete('/projects/:id', (req, res) => (store.deleteProject(req.params.id) ? res.status(204).end() : res.status(404).json({ error: 'not found' })));
  r.post('/projects/:id/requirements', (req, res) => {
    const p = store.getProject(req.params.id);
    if (!p) return res.status(404).json({ error: 'project not found' });
    if (!s(req.body?.name).trim()) return res.status(422).json({ errors: ['name is required'] });
    if (req.body.priority && !store.PRIORITIES.includes(req.body.priority)) return res.status(422).json({ errors: ['priority must be must, should or could'] });
    res.status(201).json(store.createRequirement(p.id, { name: req.body.name, priority: req.body.priority || 'must' }));
  });

  // Vendors
  r.get('/vendors', (req, res) => {
    const m = getMarket(req.query.market);
    if (!m) return res.status(400).json({ error: 'market query param required (NL, BE, DK, DE)' });
    res.json(store.listVendors(m.code));
  });
  r.post('/vendors', (req, res) => {
    const b = req.body || {};
    const m = getMarket(b.market);
    const errors = [];
    if (!m) errors.push('market must be one of NL, BE, DK, DE');
    if (!s(b.name).trim()) errors.push('name is required');
    if (!s(b.city).trim()) errors.push('city is required');
    if (!s(b.contact).trim()) errors.push('contact is required');
    if (b.contactEmail && !isEmail(b.contactEmail)) errors.push('contactEmail must be valid');
    if (!Array.isArray(b.expertise) || !b.expertise.length || b.expertise.some((x) => !store.EXPERTISE.includes(x))) errors.push(`expertise must be a non-empty array of ${store.EXPERTISE.join(', ')}`);
    if (!(Number(b.rating) >= 1 && Number(b.rating) <= 5)) errors.push('rating must be between 1 and 5');
    if (errors.length) return res.status(422).json({ errors });
    res.status(201).json(store.createVendor({ market: m.code, name: b.name, city: b.city, expertise: b.expertise, rating: b.rating, certifications: Array.isArray(b.certifications) ? b.certifications : [], contact: b.contact, contactEmail: s(b.contactEmail) }));
  });
  r.delete('/vendors/:id', (req, res) => (store.removeVendor(req.params.id) ? res.status(204).end() : res.status(404).json({ error: 'not found' })));

  // RFPs and proposals
  r.post('/projects/:id/rfps', (req, res) => {
    const p = store.getProject(req.params.id);
    if (!p) return res.status(404).json({ error: 'project not found' });
    const b = req.body || {};
    const reqIds = store.requirementsFor(p.id).map((x) => x.id);
    const venIds = store.listVendors(p.market).map((x) => x.id);
    const errors = [];
    if (!s(b.title).trim()) errors.push('title is required');
    if (!Array.isArray(b.requirementIds) || !b.requirementIds.length || b.requirementIds.some((id) => !reqIds.includes(id))) errors.push('requirementIds must reference requirements of this project');
    if (!Array.isArray(b.vendorIds) || !b.vendorIds.length || b.vendorIds.some((id) => !venIds.includes(id))) errors.push('vendorIds must reference active vendors in this market');
    if (!isDate(b.deadline)) errors.push('deadline must be YYYY-MM-DD (past dates allowed, to create closed RFPs)');
    if (errors.length) return res.status(422).json({ errors });
    res.status(201).json(store.createRfp(p.id, { title: b.title, requirementIds: b.requirementIds, vendorIds: b.vendorIds, deadline: b.deadline }));
  });
  r.get('/rfps/:id', (req, res) => {
    const rfp = store.getRfp(req.params.id);
    if (!rfp) return res.status(404).json({ error: 'not found' });
    res.json({ ...rfp, state: store.rfpState(rfp), proposals: store.proposalsFor(rfp.id), questions: store.questionsFor(rfp.id), files: store.filesFor('rfp', rfp.id) });
  });
  r.post('/rfps/:id/files', acceptFiles('files'), (req, res) => {
    const rfp = store.getRfp(req.params.id);
    if (!rfp) return res.status(404).json({ error: 'rfp not found' });
    if (req.uploadError) return res.status(422).json({ errors: [`upload rejected: ${req.uploadError}`] });
    const files = req.files.map((f) => store.registerFile({ originalName: originalName(f), storedName: f.filename, size: f.size, mime: f.mimetype, ownerType: 'rfp', ownerId: rfp.id, uploadedBy: 'api' }));
    res.status(201).json(files);
  });
  r.post('/rfps/:id/proposals', (req, res) => {
    const rfp = store.getRfp(req.params.id);
    if (!rfp) return res.status(404).json({ error: 'rfp not found' });
    const b = req.body || {};
    if (!rfp.vendorIds.includes(b.vendorId)) return res.status(422).json({ errors: ['vendorId must be invited to this RFP'] });
    if (store.proposalOf(rfp.id, b.vendorId)) return res.status(409).json({ error: 'vendor already submitted a proposal' });
    if (!store.isOpen(rfp)) return res.status(409).json({ error: 'rfp is closed' });
    const errors = [];
    if (!isPositive(b.priceNet)) errors.push('priceNet must be > 0');
    if (!(Number.isInteger(Number(b.deliveryMonths)) && Number(b.deliveryMonths) >= 1 && Number(b.deliveryMonths) <= 36)) errors.push('deliveryMonths must be an integer 1-36');
    if (errors.length) return res.status(422).json({ errors });
    res.status(201).json(store.createProposal(rfp.id, b.vendorId, { priceNet: b.priceNet, deliveryMonths: b.deliveryMonths, note: s(b.note) }));
  });

  return r;
};
