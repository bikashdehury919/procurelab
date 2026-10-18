// Domain operations. Every mutation persists the touched collections to data/*.json.
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { getMarket, calcVat } = require('./markets');
const { hashPassword } = require('./auth');
const { UPLOAD_DIR } = require('./config');

const EXPERTISE = ['cloud', 'data', 'security', 'devops', 'support', 'network'];
const PROJECT_STATUSES = ['planning', 'active', 'completed', 'archived'];
const PRIORITIES = ['must', 'should', 'could'];
const ROLES = ['admin', 'buyer', 'vendor'];

const D = () => db.data;
const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const str = (v) => String(v ?? '').trim();

// ---------- Activity ----------
function logActivity(market, type, params, { at, actor } = {}) {
  D().activity.push({ id: db.nextId('a'), market, type, params, actor: actor || null, at: at || now() });
  if (D().activity.length > 500) D().activity.splice(0, D().activity.length - 500);
}

// ---------- Users ----------
const getUser = (id) => D().users.find((u) => u.id === id) || null;
const getUserByEmail = (email) => D().users.find((u) => u.email === str(email).toLowerCase()) || null;

function createUser({ email, name, role, market, vendorId = null, password, active = true }, { actor } = {}) {
  const u = { id: db.nextId('u'), email: str(email).toLowerCase(), name: str(name), role, market, vendorId: role === 'vendor' ? vendorId : null, passwordHash: hashPassword(password), active, createdAt: now(), createdBy: actor || 'seed' };
  D().users.push(u);
  if (actor) logActivity(market, 'user_created', { user: u.name, role }, { actor });
  db.save('users', 'activity');
  return u;
}

function setUserActive(id, active) {
  const u = getUser(id);
  if (!u) return null;
  u.active = active;
  db.save('users');
  return u;
}

function setUserPassword(id, password) {
  const u = getUser(id);
  if (!u) return null;
  u.passwordHash = hashPassword(password);
  db.save('users');
  return u;
}

function deleteUser(id) {
  const n = D().users.length;
  D().users = D().users.filter((u) => u.id !== id);
  db.save('users');
  return D().users.length < n;
}

// ---------- Vendors ----------
const getVendor = (id) => D().vendors.find((v) => v.id === id) || null;

function createVendor({ market, name, city, expertise, rating, certifications = [], contact, contactEmail = '' }, { actor, silent } = {}) {
  const v = { id: db.nextId('v'), market, name: str(name), city: str(city), expertise, rating: Math.round(Number(rating) * 10) / 10, certifications, contact: str(contact), contactEmail: str(contactEmail).toLowerCase(), active: true, createdAt: now() };
  D().vendors.push(v);
  if (!silent) logActivity(market, 'vendor_added', { vendor: v.name }, { actor });
  db.save('vendors', 'activity');
  return v;
}

function removeVendor(id) {
  const v = getVendor(id);
  if (!v) return false;
  v.active = false;
  for (const p of D().projects) p.vendorIds = (p.vendorIds || []).filter((x) => x !== id);
  db.save('vendors', 'projects');
  return true;
}

function listVendors(market, { q = '', expertise = '', minRating = 0 } = {}) {
  const needle = str(q).toLowerCase();
  return D().vendors.filter((v) => v.market === market && v.active
    && (!expertise || v.expertise.includes(expertise))
    && v.rating >= Number(minRating || 0)
    && (!needle || `${v.name} ${v.city} ${v.contact} ${v.certifications.join(' ')}`.toLowerCase().includes(needle)));
}

// ---------- Projects ----------
const getProject = (id) => D().projects.find((p) => p.id === id) || null;

function createProject({ market, name, description = '', budget, startDate, endDate, owner, status = 'planning' }, { actor, silent, at } = {}) {
  const p = { id: db.nextId('p'), market, name: str(name), description: str(description), budget: Number(budget), startDate, endDate, owner: str(owner), status, vendorIds: [], createdAt: at || now() };
  D().projects.push(p);
  if (!silent) logActivity(market, 'project_created', { project: p.name }, { actor, at });
  db.save('projects', 'activity');
  return p;
}

function updateProject(id, fields) {
  const p = getProject(id);
  if (!p) return null;
  Object.assign(p, { name: str(fields.name), owner: str(fields.owner), description: str(fields.description), budget: Number(fields.budget), startDate: fields.startDate, endDate: fields.endDate, status: fields.status });
  db.save('projects');
  return p;
}

function setProjectStatus(id, status) {
  const p = getProject(id);
  if (!p) return null;
  if (status === 'archived') p.previousStatus = p.status;
  p.status = status;
  db.save('projects');
  return p;
}

function listProjects(market, { q = '', status = '' } = {}) {
  const needle = str(q).toLowerCase();
  return D().projects.filter((p) => p.market === market
    && (status ? p.status === status : p.status !== 'archived')
    && (!needle || `${p.name} ${p.description} ${p.owner}`.toLowerCase().includes(needle)));
}

const projectNameTaken = (market, name, exceptId) => D().projects.some((p) => p.market === market && p.id !== exceptId && p.name.toLowerCase() === str(name).toLowerCase());

function assignVendor(projectId, vendorId, { actor } = {}) {
  const p = getProject(projectId);
  const v = getVendor(vendorId);
  if (!p || !v || p.vendorIds.includes(vendorId)) return false;
  p.vendorIds.push(vendorId);
  logActivity(p.market, 'vendor_assigned', { vendor: v.name, project: p.name }, { actor });
  db.save('projects', 'activity');
  return true;
}

function unassignVendor(projectId, vendorId) {
  const p = getProject(projectId);
  if (!p) return false;
  p.vendorIds = p.vendorIds.filter((x) => x !== vendorId);
  db.save('projects');
  return true;
}

function deleteProject(id) {
  const rfpIds = D().rfps.filter((r) => r.projectId === id).map((r) => r.id);
  const proposalIds = D().proposals.filter((x) => rfpIds.includes(x.rfpId)).map((x) => x.id);
  const n = D().projects.length;
  D().projects = D().projects.filter((p) => p.id !== id);
  D().requirements = D().requirements.filter((r) => r.projectId !== id);
  D().rfps = D().rfps.filter((r) => r.projectId !== id);
  D().proposals = D().proposals.filter((x) => !rfpIds.includes(x.rfpId));
  D().questions = D().questions.filter((q) => !rfpIds.includes(q.rfpId));
  const orphanFiles = D().files.filter((f) => (f.ownerType === 'rfp' && rfpIds.includes(f.ownerId)) || (f.ownerType === 'proposal' && proposalIds.includes(f.ownerId)));
  for (const f of orphanFiles) fs.rmSync(path.join(UPLOAD_DIR, f.storedName), { force: true });
  D().files = D().files.filter((f) => !orphanFiles.includes(f));
  db.save();
  return D().projects.length < n;
}

// ---------- Requirements ----------
const getRequirement = (id) => D().requirements.find((r) => r.id === id) || null;
const requirementsFor = (projectId) => D().requirements.filter((r) => r.projectId === projectId);

function createRequirement(projectId, { name, priority = 'must' }) {
  const r = { id: db.nextId('q'), projectId, name: str(name), priority: PRIORITIES.includes(priority) ? priority : 'must' };
  D().requirements.push(r);
  db.save('requirements');
  return r;
}

function deleteRequirement(id) {
  const n = D().requirements.length;
  D().requirements = D().requirements.filter((r) => r.id !== id);
  db.save('requirements');
  return D().requirements.length < n;
}

// ---------- Files ----------
const getFile = (id) => D().files.find((f) => f.id === id) || null;
const filesFor = (ownerType, ownerId) => D().files.filter((f) => f.ownerType === ownerType && f.ownerId === ownerId);

// Register a file already written to UPLOAD_DIR (by multer or the seeder).
function registerFile({ originalName, storedName, size, mime, ownerType, ownerId, uploadedBy }) {
  const f = { id: db.nextId('f'), originalName, storedName, size, mime, ownerType, ownerId, uploadedBy, uploadedAt: now() };
  D().files.push(f);
  db.save('files');
  return f;
}

function attachFiles(ownerType, ownerId, files) {
  for (const f of files) { f.ownerType = ownerType; f.ownerId = ownerId; }
  db.save('files');
}

const filePath = (f) => path.join(UPLOAD_DIR, f.storedName);

// ---------- RFPs ----------
const getRfp = (id) => D().rfps.find((r) => r.id === id) || null;
const isOpen = (rfp) => rfp.status !== 'awarded' && rfp.deadline >= today();
const rfpState = (rfp) => (rfp.status === 'awarded' ? 'awarded' : isOpen(rfp) ? 'open' : 'closed');

function createRfp(projectId, { title, requirementIds, vendorIds, deadline }, { actor, at } = {}) {
  const p = getProject(projectId);
  const r = { id: db.nextId('r'), projectId, title: str(title), requirementIds, vendorIds, deadline, status: 'sent', awardedProposalId: null, aiSummary: null, createdAt: at || now(), createdBy: actor || 'seed' };
  D().rfps.push(r);
  for (const vid of vendorIds) if (!p.vendorIds.includes(vid)) p.vendorIds.push(vid);
  logActivity(p.market, 'rfp_sent', { rfp: r.title, count: vendorIds.length }, { actor, at });
  db.save('rfps', 'projects', 'activity');
  return r;
}

// Feature (flag deadlineExtension): extend an open RFP's deadline by 1 to 30 days.
function extendRfpDeadline(rfpId, days, { actor } = {}) {
  const r = getRfp(rfpId);
  const p = getProject(r.projectId);
  const d = new Date(`${r.deadline}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  if (!r.originalDeadline) r.originalDeadline = r.deadline;
  r.deadline = d.toISOString().slice(0, 10);
  r.extendedAt = now();
  logActivity(p.market, 'deadline_extended', { rfp: r.title, date: r.deadline }, { actor });
  db.save('rfps', 'activity');
  return r;
}

const rfpsForProject = (projectId) => D().rfps.filter((r) => r.projectId === projectId);
const rfpsForVendor = (vendorId) => D().rfps.filter((r) => r.vendorIds.includes(vendorId));
const rfpsForMarket = (market) => D().rfps.filter((r) => getProject(r.projectId)?.market === market);

function saveAiSummary(rfpId, summary) {
  const r = getRfp(rfpId);
  r.aiSummary = summary;
  db.save('rfps');
}

// ---------- Proposals ----------
const getProposal = (id) => D().proposals.find((x) => x.id === id) || null;
const proposalsFor = (rfpId) => D().proposals.filter((x) => x.rfpId === rfpId);
const proposalOf = (rfpId, vendorId) => D().proposals.find((x) => x.rfpId === rfpId && x.vendorId === vendorId) || null;

function createProposal(rfpId, vendorId, { priceNet, deliveryMonths, note = '' }, { at } = {}) {
  const rfp = getRfp(rfpId);
  const p = getProject(rfp.projectId);
  const { net, vat, gross } = calcVat(priceNet, getMarket(p.market).vatRate);
  const x = { id: db.nextId('o'), rfpId, vendorId, priceNet: net, vat, gross, deliveryMonths: Number(deliveryMonths), note: str(note), status: 'submitted', submittedAt: at || now() };
  D().proposals.push(x);
  logActivity(p.market, 'proposal_received', { vendor: getVendor(vendorId).name, rfp: rfp.title }, { at: x.submittedAt });
  db.save('proposals', 'activity');
  return x;
}

function awardProposal(proposalId, { actor } = {}) {
  const x = getProposal(proposalId);
  const rfp = getRfp(x.rfpId);
  for (const other of proposalsFor(rfp.id)) other.status = other.id === x.id ? 'awarded' : 'rejected';
  rfp.status = 'awarded';
  rfp.awardedProposalId = x.id;
  logActivity(getProject(rfp.projectId).market, 'vendor_selected', { vendor: getVendor(x.vendorId).name, rfp: rfp.title }, { actor });
  db.save('proposals', 'rfps', 'activity');
  return x;
}

function rejectProposal(proposalId) {
  const x = getProposal(proposalId);
  x.status = 'rejected';
  db.save('proposals');
  return x;
}

// ---------- Questions ----------
const getQuestion = (id) => D().questions.find((q) => q.id === id) || null;
const questionsFor = (rfpId) => D().questions.filter((q) => q.rfpId === rfpId);

function createQuestion(rfpId, vendorId, text) {
  const q = { id: db.nextId('k'), rfpId, vendorId, text: str(text), answer: null, askedAt: now(), answeredAt: null };
  D().questions.push(q);
  const rfp = getRfp(rfpId);
  logActivity(getProject(rfp.projectId).market, 'question_asked', { vendor: getVendor(vendorId).name, rfp: rfp.title });
  db.save('questions', 'activity');
  return q;
}

function answerQuestion(id, answer) {
  const q = getQuestion(id);
  q.answer = str(answer);
  q.answeredAt = now();
  db.save('questions');
  return q;
}

// ---------- Dashboard ----------
function dashboardStats(market) {
  const rfps = rfpsForMarket(market);
  return {
    projects: D().projects.filter((p) => p.market === market && p.status !== 'archived').length,
    activeRfps: rfps.filter(isOpen).length,
    proposals: D().proposals.filter((x) => rfps.some((r) => r.id === x.rfpId)).length,
    vendors: D().vendors.filter((v) => v.market === market && v.active).length,
  };
}

const activityFor = (market, limit = 8) => D().activity.filter((a) => a.market === market).sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);

module.exports = {
  EXPERTISE, PROJECT_STATUSES, PRIORITIES, ROLES, today, logActivity,
  getUser, getUserByEmail, createUser, setUserActive, setUserPassword, deleteUser, listUsers: () => [...D().users],
  getVendor, createVendor, removeVendor, listVendors,
  getProject, createProject, updateProject, setProjectStatus, listProjects, projectNameTaken, assignVendor, unassignVendor, deleteProject,
  getRequirement, requirementsFor, createRequirement, deleteRequirement,
  getFile, filesFor, registerFile, attachFiles, filePath,
  getRfp, isOpen, rfpState, createRfp, extendRfpDeadline, rfpsForProject, rfpsForVendor, rfpsForMarket, saveAiSummary,
  getProposal, proposalsFor, proposalOf, createProposal, awardProposal, rejectProposal,
  getQuestion, questionsFor, createQuestion, answerQuestion,
  dashboardStats, activityFor,
};
