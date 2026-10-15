const express = require('express');
const store = require('../store');
const { getMarket, getLang } = require('../markets');
const { verifyPassword } = require('../auth');
const { analyzeProposals, aiSummary } = require('../insights');
const { acceptFiles, originalName, discard } = require('../uploads');
const { MAX_UPLOAD_MB } = require('../config');
const buyerViews = require('../views/buyer');
const vendorViews = require('../views/vendor');
const { loginPage, notFoundPage, forbiddenPage } = require('../views/admin');

const arr = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const isPositive = (v) => v !== '' && v !== undefined && Number.isFinite(Number(v)) && Number(v) > 0;
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !Number.isNaN(Date.parse(v));
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ''));
const safeNext = (n) => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') ? n : null);
const uploadErrorText = (t, code) => (code ? t({ size: 'errUploadSize', count: 'errUploadCount', type: 'errUploadType' }[code] || 'errUploadOther', { mb: MAX_UPLOAD_MB }) : null);

const requireAuth = (req, res, next) => (req.ctx.user ? next() : res.redirect('/login?next=' + encodeURIComponent(req.originalUrl)));
const requireRole = (...roles) => (req, res, next) => (roles.includes(req.ctx.user.role) ? next() : res.status(403).send(forbiddenPage(req.ctx)));
const buyer = [requireAuth, requireRole('buyer', 'admin')];
const vendorOnly = [requireAuth, requireRole('vendor')];

function analysisFor(rfp) {
  return analyzeProposals(store.proposalsFor(rfp.id).map((x) => {
    const v = store.getVendor(x.vendorId);
    return { proposalId: x.id, vendorName: v.name, priceNet: x.priceNet, deliveryMonths: x.deliveryMonths, rating: v.rating, documents: store.filesFor('proposal', x.id).length };
  }));
}

module.exports = function uiRoutes() {
  const router = express.Router();

  // ---------- Session, market, language ----------
  router.get('/', (req, res) => res.redirect(!req.ctx.user ? '/login' : req.ctx.user.role === 'vendor' ? '/portal' : '/dashboard'));

  router.get('/market', (req, res) => {
    const m = getMarket(req.query.code);
    if (m && req.ctx.user?.role !== 'vendor') { req.session.market = m.code; delete req.session.lang; }
    res.redirect(req.ctx.user ? '/' : '/login');
  });

  router.get('/lang', (req, res) => {
    const l = getLang(req.query.code);
    if (l) req.session.lang = l;
    const back = req.get('referer');
    try { if (back) { const u = new URL(back); if (u.host === req.get('host')) return res.redirect(u.pathname + u.search); } } catch { /* ignore */ }
    res.redirect('/');
  });

  router.get('/login', (req, res) => {
    if (req.ctx.user) return res.redirect('/');
    req.ctx.next = safeNext(req.query.next);
    res.send(loginPage(req.ctx));
  });

  router.post('/login', (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const u = store.getUserByEmail(email);
    req.ctx.next = safeNext(req.query.next);
    if (!u || !verifyPassword(req.body.password, u.passwordHash)) return res.status(401).send(loginPage(req.ctx, { error: req.ctx.t('invalidCredentials'), email }));
    if (!u.active) return res.status(403).send(loginPage(req.ctx, { error: req.ctx.t('accountLocked'), email }));
    let name = u.name;
    if (u.role === 'vendor') {
      const v = store.getVendor(u.vendorId);
      name = `${u.name} (${v ? v.name : '?'})`;
      if (req.session.market !== u.market) delete req.session.lang;
      req.session.market = u.market;
    } else if (!req.session.market) {
      req.session.market = u.market;
    }
    req.session.user = { id: u.id, email: u.email, name, role: u.role, vendorId: u.vendorId };
    const next = req.ctx.next;
    res.redirect(next && !(u.role === 'vendor' && !next.startsWith('/portal')) ? next : '/');
  });

  router.post('/logout', (req, res) => {
    const { market, lang } = req.session;
    req.session = null;
    res.redirect(`/login?market=${market || ''}${lang ? `&lang=${lang}` : ''}`);
  });

  // ---------- Dashboard ----------
  router.get('/dashboard', buyer, (req, res) => {
    const m = req.ctx.market.code;
    res.send(buyerViews.dashboard(req.ctx, { stats: store.dashboardStats(m), activity: store.activityFor(m) }));
  });

  // ---------- Projects ----------
  router.get('/projects', buyer, (req, res) => {
    const q = String(req.query.q || '');
    const status = store.PROJECT_STATUSES.includes(req.query.status) ? req.query.status : '';
    const msgKey = { archived: 'projectArchived' }[req.query.msg];
    res.send(buyerViews.projectsList(req.ctx, { projects: store.listProjects(req.ctx.market.code, { q, status }), q, status, message: msgKey && req.ctx.t(msgKey) }));
  });

  function validateProject(req, exceptId) {
    const { t, market } = req.ctx;
    const b = req.body;
    const values = { name: b.name || '', owner: b.owner || '', budget: b.budget || '', startDate: b.startDate || '', endDate: b.endDate || '', description: b.description || '', status: ['planning', 'active', 'completed'].includes(b.status) ? b.status : 'planning' };
    const errors = {};
    if (!values.name.trim()) errors.name = t('errName');
    else if (store.projectNameTaken(market.code, values.name, exceptId)) errors.name = t('errDuplicateName');
    if (!values.owner.trim()) errors.owner = t('errOwner');
    if (!isPositive(values.budget)) errors.budget = t('errBudget');
    if (!isDate(values.startDate)) errors.startDate = t('errDate');
    if (!isDate(values.endDate)) errors.endDate = t('errDate');
    else if (isDate(values.startDate) && values.endDate < values.startDate) errors.endDate = t('errDates');
    return { values, errors };
  }

  router.get('/projects/new', buyer, (req, res) => res.send(buyerViews.projectForm(req.ctx, {})));

  router.post('/projects', buyer, (req, res) => {
    const { values, errors } = validateProject(req);
    if (Object.keys(errors).length) return res.status(422).send(buyerViews.projectForm(req.ctx, { values, errors }));
    const p = store.createProject({ market: req.ctx.market.code, ...values }, { actor: req.ctx.user.email });
    res.redirect(`/projects/${p.id}?msg=created`);
  });

  function loadProject(req, res, next) {
    const p = store.getProject(req.params.id);
    if (!p || p.market !== req.ctx.market.code) return res.status(404).send(notFoundPage(req.ctx));
    req.project = p;
    next();
  }

  const renderProject = (req, res, extra = {}) => {
    const p = req.project;
    const msgKey = { created: 'projectCreated', updated: 'projectUpdated', restored: 'projectRestored', assigned: 'vendorAssigned' }[req.query.msg];
    const assigned = p.vendorIds.map(store.getVendor).filter((v) => v && v.active);
    const assignable = store.listVendors(p.market).filter((v) => !p.vendorIds.includes(v.id));
    res.send(buyerViews.projectDetail(req.ctx, { project: p, requirements: store.requirementsFor(p.id), assigned, assignable, rfps: store.rfpsForProject(p.id), message: msgKey && req.ctx.t(msgKey), ...extra }));
  };

  router.get('/projects/:id', buyer, loadProject, (req, res) => renderProject(req, res));
  router.get('/projects/:id/edit', buyer, loadProject, (req, res) => res.send(buyerViews.projectForm(req.ctx, { project: req.project })));

  router.post('/projects/:id', buyer, loadProject, (req, res) => {
    const { values, errors } = validateProject(req, req.project.id);
    if (Object.keys(errors).length) return res.status(422).send(buyerViews.projectForm(req.ctx, { project: req.project, values, errors }));
    store.updateProject(req.project.id, values);
    res.redirect(`/projects/${req.project.id}?msg=updated`);
  });

  router.post('/projects/:id/archive', buyer, loadProject, (req, res) => {
    store.setProjectStatus(req.project.id, 'archived');
    res.redirect('/projects?msg=archived');
  });

  router.post('/projects/:id/restore', buyer, loadProject, (req, res) => {
    const prev = req.project.previousStatus && req.project.previousStatus !== 'archived' ? req.project.previousStatus : 'planning';
    store.setProjectStatus(req.project.id, prev);
    res.redirect(`/projects/${req.project.id}?msg=restored`);
  });

  router.post('/projects/:id/requirements', buyer, loadProject, (req, res) => {
    const name = String(req.body.reqName || '');
    if (!name.trim()) { res.status(422); return renderProject(req, res, { reqError: req.ctx.t('errRequirement'), reqValue: name }); }
    store.createRequirement(req.project.id, { name, priority: req.body.reqPriority });
    res.redirect(`/projects/${req.project.id}`);
  });

  router.post('/requirements/:id/delete', buyer, (req, res) => {
    const r = store.getRequirement(req.params.id);
    const p = r && store.getProject(r.projectId);
    if (!r || !p || p.market !== req.ctx.market.code) return res.status(404).send(notFoundPage(req.ctx));
    store.deleteRequirement(r.id);
    res.redirect(`/projects/${p.id}`);
  });

  router.post('/projects/:id/vendors', buyer, loadProject, (req, res) => {
    const v = store.getVendor(req.body.vendorId);
    if (!v || v.market !== req.project.market || !v.active) return res.status(404).send(notFoundPage(req.ctx));
    store.assignVendor(req.project.id, v.id, { actor: req.ctx.user.email });
    res.redirect(`/projects/${req.project.id}?msg=assigned`);
  });

  router.post('/projects/:id/vendors/:vendorId/unassign', buyer, loadProject, (req, res) => {
    store.unassignVendor(req.project.id, req.params.vendorId);
    res.redirect(`/projects/${req.project.id}`);
  });

  // ---------- RFPs ----------
  router.get('/projects/:id/rfps/new', buyer, loadProject, (req, res) => {
    res.send(buyerViews.rfpForm(req.ctx, { project: req.project, requirements: store.requirementsFor(req.project.id), vendors: store.listVendors(req.ctx.market.code) }));
  });

  router.post('/projects/:id/rfps', buyer, loadProject, acceptFiles('attachments'), (req, res) => {
    const { t, market } = req.ctx;
    const requirements = store.requirementsFor(req.project.id);
    const vendors = store.listVendors(market.code);
    const values = {
      title: req.body.title || '', deadline: req.body.deadline || '',
      requirementIds: arr(req.body.requirementIds).filter((id) => requirements.some((r) => r.id === id)),
      vendorIds: arr(req.body.vendorIds).filter((id) => vendors.some((v) => v.id === id)),
    };
    const errors = {};
    if (!values.title.trim()) errors.title = t('errTitle');
    if (!values.requirementIds.length) errors.requirementIds = t('errRequirements');
    if (!values.vendorIds.length) errors.vendorIds = t('errVendors');
    if (!isDate(values.deadline) || values.deadline < store.today()) errors.deadline = t('errDeadline');
    if (req.uploadError) errors.files = uploadErrorText(t, req.uploadError);
    if (Object.keys(errors).length) {
      discard(req.files);
      return res.status(422).send(buyerViews.rfpForm(req.ctx, { project: req.project, requirements, vendors, values, errors }));
    }
    const rfp = store.createRfp(req.project.id, values, { actor: req.ctx.user.email });
    for (const f of req.files) store.registerFile({ originalName: originalName(f), storedName: f.filename, size: f.size, mime: f.mimetype, ownerType: 'rfp', ownerId: rfp.id, uploadedBy: req.ctx.user.email });
    res.redirect(`/rfps/${rfp.id}?msg=sent`);
  });

  function loadRfp(req, res, next) {
    const rfp = store.getRfp(req.params.id);
    const project = rfp && store.getProject(rfp.projectId);
    if (!rfp || !project || project.market !== req.ctx.market.code) return res.status(404).send(notFoundPage(req.ctx));
    req.rfp = rfp;
    req.project = project;
    next();
  }

  router.get('/rfps/:id', buyer, loadRfp, (req, res) => {
    const { t } = req.ctx;
    const { rfp } = req;
    const sort = ['price', 'delivery', 'rating'].includes(req.query.sort) ? req.query.sort : 'price';
    const minRating = ['3', '3.5', '4', '4.5'].includes(String(req.query.minRating)) ? String(req.query.minRating) : '';
    const all = store.proposalsFor(rfp.id).map((proposal) => ({ proposal, vendor: store.getVendor(proposal.vendorId) }));
    const sorters = { price: (a, b) => a.proposal.priceNet - b.proposal.priceNet, delivery: (a, b) => a.proposal.deliveryMonths - b.proposal.deliveryMonths, rating: (a, b) => b.vendor.rating - a.vendor.rating };
    const rows = all.filter((r) => r.vendor.rating >= Number(minRating || 0)).sort(sorters[sort]);
    const selected = req.query.vendor ? store.getVendor(req.query.vendor) : null;
    const message = req.query.msg === 'sent' ? t('rfpSent', { count: rfp.vendorIds.length })
      : req.query.msg === 'selected' && selected ? t('selectedMsg', { vendor: selected.name })
      : req.query.msg === 'rejected' ? t('rejectedMsg') : req.query.msg === 'answered' ? t('answerSaved')
      : req.query.msg === 'extended' ? t('deadlineExtended', { date: req.ctx.fmt.date(rfp.deadline) }) : null;
    const notice = req.query.ai === 'unavailable' ? t('aiUnavailable') : req.query.ai === 'failed' ? t('aiFailed') : req.query.compare === 'invalid' ? t('errCompare') : null;
    res.send(buyerViews.rfpDetail(req.ctx, {
      project: req.project, rfp, rows, analysis: analysisFor(rfp), sort, minRating, message, notice,
      extendError: req.query.extend === 'invalid' ? t('errExtendDays') : req.query.extend === 'closed' ? t('errExtendClosed') : null,
      extendDays: req.query.extend === 'invalid' ? String(req.query.days || '') : '7',
      requirements: rfp.requirementIds.map(store.getRequirement).filter(Boolean),
      invited: rfp.vendorIds.map((id) => ({ vendor: store.getVendor(id), responded: !!store.proposalOf(rfp.id, id) })).filter((x) => x.vendor),
      files: store.filesFor('rfp', rfp.id),
    }));
  });

  // Feature behind the deadlineExtension flag: POST days=1..30 on an open RFP.
  router.post('/rfps/:id/extend', buyer, loadRfp, (req, res) => {
    if (!req.ctx.flags.deadlineExtension) return res.status(404).send(notFoundPage(req.ctx));
    if (!store.isOpen(req.rfp)) return res.redirect(`/rfps/${req.rfp.id}?extend=closed`);
    const raw = String(req.body.days ?? '').trim();
    const days = Number(raw);
    if (!/^\d+$/.test(raw) || days < 1 || days > 30) return res.redirect(`/rfps/${req.rfp.id}?extend=invalid&days=${encodeURIComponent(raw)}`);
    store.extendRfpDeadline(req.rfp.id, days, { actor: req.ctx.user.email });
    res.redirect(`/rfps/${req.rfp.id}?msg=extended`);
  });

  router.get('/rfps/:id/compare', buyer, loadRfp, (req, res) => {
    const ids = [...new Set(arr(req.query.ids))];
    const proposals = ids.map(store.getProposal).filter((x) => x && x.rfpId === req.rfp.id);
    if (proposals.length < 2 || proposals.length > 3) return res.redirect(`/rfps/${req.rfp.id}?compare=invalid`);
    const analysis = analysisFor(req.rfp);
    const items = proposals.map((proposal) => ({ proposal, vendor: store.getVendor(proposal.vendorId), files: store.filesFor('proposal', proposal.id), analysis: analysis.find((a) => a.proposalId === proposal.id) }));
    res.send(buyerViews.compareView(req.ctx, { project: req.project, rfp: req.rfp, items }));
  });

  function loadProposal(req, res, next) {
    const x = store.getProposal(req.params.id);
    const rfp = x && store.getRfp(x.rfpId);
    const project = rfp && store.getProject(rfp.projectId);
    if (!x || !project || project.market !== req.ctx.market.code) return res.status(404).send(notFoundPage(req.ctx));
    req.proposal = x; req.rfp = rfp; req.project = project;
    next();
  }

  router.get('/proposals/:id', buyer, loadProposal, (req, res) => {
    res.send(buyerViews.proposalDetail(req.ctx, { project: req.project, rfp: req.rfp, proposal: req.proposal, vendor: store.getVendor(req.proposal.vendorId), files: store.filesFor('proposal', req.proposal.id), analysis: analysisFor(req.rfp).find((a) => a.proposalId === req.proposal.id) }));
  });

  router.post('/proposals/:id/select', buyer, loadProposal, (req, res) => {
    if (req.rfp.status === 'awarded' || req.proposal.status !== 'submitted') return res.redirect(`/rfps/${req.rfp.id}`);
    store.awardProposal(req.proposal.id, { actor: req.ctx.user.email });
    res.redirect(`/rfps/${req.rfp.id}?msg=selected&vendor=${req.proposal.vendorId}`);
  });

  router.post('/proposals/:id/reject', buyer, loadProposal, (req, res) => {
    if (req.rfp.status !== 'awarded' && req.proposal.status === 'submitted') store.rejectProposal(req.proposal.id);
    res.redirect(`/rfps/${req.rfp.id}?msg=rejected`);
  });

  router.post('/rfps/:id/ai-summary', buyer, loadRfp, async (req, res) => {
    const analysis = analysisFor(req.rfp);
    if (!analysis.length) return res.redirect(`/rfps/${req.rfp.id}`);
    const result = await aiSummary({ rfpTitle: req.rfp.title, currency: req.ctx.market.currency, lang: req.ctx.lang, analysis });
    if (!result.ok) {
      if (result.reason !== 'not_configured') console.warn('[ai-summary]', result.reason, result.detail || '');
      return res.redirect(`/rfps/${req.rfp.id}?ai=${result.reason === 'not_configured' ? 'unavailable' : 'failed'}`);
    }
    store.saveAiSummary(req.rfp.id, { text: result.text, model: result.model, lang: req.ctx.lang, usage: result.usage, at: new Date().toISOString() });
    res.redirect(`/rfps/${req.rfp.id}`);
  });

  router.post('/questions/:id/answer', buyer, (req, res) => {
    const q = store.getQuestion(req.params.id);
    const rfp = q && store.getRfp(q.rfpId);
    const project = rfp && store.getProject(rfp.projectId);
    if (!q || !project || project.market !== req.ctx.market.code) return res.status(404).send(notFoundPage(req.ctx));
    const answer = String(req.body.answer || '').trim();
    if (answer) store.answerQuestion(q.id, answer);
    res.redirect(`/rfps/${rfp.id}${answer ? '?msg=answered' : ''}`);
  });

  // ---------- Vendors ----------
  router.get('/vendors', buyer, (req, res) => {
    const q = String(req.query.q || '');
    const expertise = store.EXPERTISE.includes(req.query.expertise) ? req.query.expertise : '';
    const minRating = ['3', '4', '4.5'].includes(req.query.minRating) ? req.query.minRating : '';
    const msgKey = { added: 'vendorAdded', removed: 'vendorRemoved' }[req.query.msg];
    res.send(buyerViews.vendorsList(req.ctx, { vendors: store.listVendors(req.ctx.market.code, { q, expertise, minRating }), q, expertise, minRating, all: store.EXPERTISE, message: msgKey && req.ctx.t(msgKey) }));
  });

  router.get('/vendors/new', buyer, (req, res) => res.send(buyerViews.vendorForm(req.ctx, { all: store.EXPERTISE })));

  router.post('/vendors', buyer, (req, res) => {
    const { t, market } = req.ctx;
    const b = req.body;
    const values = { name: b.name || '', city: b.city || '', contact: b.contact || '', contactEmail: b.contactEmail || '', rating: b.rating || '', certifications: b.certifications || '', expertise: arr(b.expertise).filter((x) => store.EXPERTISE.includes(x)) };
    const errors = {};
    if (!values.name.trim()) errors.name = t('errVendorName');
    if (!values.city.trim()) errors.city = t('errCity');
    if (!values.contact.trim()) errors.contact = t('errContact');
    if (values.contactEmail && !isEmail(values.contactEmail)) errors.contactEmail = t('errEmail');
    const r = Number(values.rating);
    if (values.rating === '' || !Number.isFinite(r) || r < 1 || r > 5) errors.rating = t('errRating');
    if (!values.expertise.length) errors.expertise = t('errExpertise');
    if (Object.keys(errors).length) return res.status(422).send(buyerViews.vendorForm(req.ctx, { all: store.EXPERTISE, values, errors }));
    store.createVendor({ market: market.code, ...values, certifications: values.certifications.split(',').map((s) => s.trim()).filter(Boolean) }, { actor: req.ctx.user.email });
    res.redirect('/vendors?msg=added');
  });

  function loadVendor(req, res, next) {
    const v = store.getVendor(req.params.id);
    if (!v || !v.active || v.market !== req.ctx.market.code) return res.status(404).send(notFoundPage(req.ctx));
    req.vendor = v;
    next();
  }

  router.get('/vendors/:id', buyer, loadVendor, (req, res) => {
    const history = store.rfpsForVendor(req.vendor.id).map((rfp) => ({ rfp, proposal: store.proposalOf(rfp.id, req.vendor.id) }));
    const projects = store.listProjects(req.ctx.market.code).filter((p) => !p.vendorIds.includes(req.vendor.id));
    res.send(buyerViews.vendorDetail(req.ctx, { vendor: req.vendor, history, projects, message: req.query.msg === 'assigned' ? req.ctx.t('vendorAssigned') : null }));
  });

  router.post('/vendors/:id/assign', buyer, loadVendor, (req, res) => {
    const p = store.getProject(req.body.projectId);
    if (!p || p.market !== req.ctx.market.code) return res.status(404).send(notFoundPage(req.ctx));
    store.assignVendor(p.id, req.vendor.id, { actor: req.ctx.user.email });
    res.redirect(`/vendors/${req.vendor.id}?msg=assigned`);
  });

  router.post('/vendors/:id/remove', buyer, loadVendor, (req, res) => {
    store.removeVendor(req.vendor.id);
    res.redirect('/vendors?msg=removed');
  });

  // ---------- File download (role and market aware) ----------
  router.get('/files/:id', requireAuth, (req, res) => {
    const f = store.getFile(req.params.id);
    if (!f) return res.status(404).send(notFoundPage(req.ctx));
    const rfp = f.ownerType === 'rfp' ? store.getRfp(f.ownerId) : store.getRfp(store.getProposal(f.ownerId)?.rfpId);
    const project = rfp && store.getProject(rfp.projectId);
    const user = req.ctx.user;
    let allowed = false;
    if (project && user.role !== 'vendor') allowed = project.market === req.ctx.market.code;
    if (project && user.role === 'vendor') {
      allowed = f.ownerType === 'rfp' ? rfp.vendorIds.includes(user.vendorId) : store.getProposal(f.ownerId)?.vendorId === user.vendorId;
    }
    if (!allowed) return res.status(404).send(notFoundPage(req.ctx));
    res.download(store.filePath(f), f.originalName, (err) => { if (err && !res.headersSent) res.status(404).send(notFoundPage(req.ctx)); });
  });

  // ---------- Vendor portal ----------
  const withVendor = (req, res, next) => { req.ctx.vendor = store.getVendor(req.ctx.user.vendorId); return req.ctx.vendor ? next() : res.status(403).send(forbiddenPage(req.ctx)); };

  router.get('/portal', vendorOnly, withVendor, (req, res) => {
    const invitations = store.rfpsForVendor(req.ctx.vendor.id)
      .map((rfp) => ({ rfp, project: store.getProject(rfp.projectId), state: vendorViews.invitationState(store, rfp, req.ctx.vendor.id) }))
      .sort((a, b) => b.rfp.deadline.localeCompare(a.rfp.deadline));
    res.send(vendorViews.portal(req.ctx, { invitations }));
  });

  function loadInvitation(req, res, next) {
    const rfp = store.getRfp(req.params.id);
    if (!rfp || !rfp.vendorIds.includes(req.ctx.vendor.id)) return res.status(404).send(notFoundPage(req.ctx));
    req.rfp = rfp;
    req.project = store.getProject(rfp.projectId);
    next();
  }

  const renderPortalRfp = (req, res, extra = {}) => {
    const msgKey = { submitted: 'proposalSubmitted', asked: 'questionSent' }[req.query.msg];
    const state = vendorViews.invitationState(store, req.rfp, req.ctx.vendor.id);
    res.send(vendorViews.portalRfp(req.ctx, {
      rfp: req.rfp, project: req.project, state,
      requirements: req.rfp.requirementIds.map(store.getRequirement).filter(Boolean),
      rfpFiles: store.filesFor('rfp', req.rfp.id),
      proposalFiles: state.proposal ? store.filesFor('proposal', state.proposal.id) : [],
      questions: store.questionsFor(req.rfp.id).filter((q) => q.vendorId === req.ctx.vendor.id),
      message: msgKey && req.ctx.t(msgKey), ...extra,
    }));
  };

  router.get('/portal/rfps/:id', vendorOnly, withVendor, loadInvitation, (req, res) => renderPortalRfp(req, res));

  router.post('/portal/rfps/:id/proposal', vendorOnly, withVendor, loadInvitation, acceptFiles('documents'), (req, res) => {
    const { t } = req.ctx;
    const values = { priceNet: req.body.priceNet || '', deliveryMonths: req.body.deliveryMonths || '', note: req.body.note || '' };
    const errors = {};
    if (store.proposalOf(req.rfp.id, req.ctx.vendor.id)) errors.form = t('alreadySubmitted');
    else if (!store.isOpen(req.rfp)) errors.form = t('errClosed');
    if (!isPositive(values.priceNet)) errors.priceNet = t('errPrice');
    const m = Number(values.deliveryMonths);
    if (!Number.isInteger(m) || m < 1 || m > 36) errors.deliveryMonths = t('errDelivery');
    if (req.uploadError) errors.files = uploadErrorText(t, req.uploadError);
    if (Object.keys(errors).length) {
      discard(req.files);
      res.status(errors.form ? 409 : 422);
      return renderPortalRfp(req, res, { values, errors });
    }
    const x = store.createProposal(req.rfp.id, req.ctx.vendor.id, values);
    for (const f of req.files) store.registerFile({ originalName: originalName(f), storedName: f.filename, size: f.size, mime: f.mimetype, ownerType: 'proposal', ownerId: x.id, uploadedBy: req.ctx.user.email });
    res.redirect(`/portal/rfps/${req.rfp.id}?msg=submitted`);
  });

  router.post('/portal/rfps/:id/questions', vendorOnly, withVendor, loadInvitation, (req, res) => {
    if (!req.ctx.flags.vendorQuestions) return res.status(404).send(notFoundPage(req.ctx));
    const text = String(req.body.question || '');
    if (!store.isOpen(req.rfp)) { res.status(409); return renderPortalRfp(req, res); }
    if (!text.trim()) { res.status(422); return renderPortalRfp(req, res, { values: { question: text }, errors: { question: req.ctx.t('errQuestion') } }); }
    store.createQuestion(req.rfp.id, req.ctx.vendor.id, text);
    res.redirect(`/portal/rfps/${req.rfp.id}?msg=asked`);
  });

  return router;
};
