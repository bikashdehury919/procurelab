// JSON-file persistence. Each collection lives in its own file under DATA_DIR so you can
// open data/users.json during the demo and see the user you just created.
// Writes are synchronous and atomic (write to .tmp, then rename). Single-process only.
const fs = require('fs');
const path = require('path');
const { DATA_DIR, UPLOAD_DIR } = require('./config');

const COLLECTIONS = ['users', 'vendors', 'projects', 'requirements', 'rfps', 'proposals', 'questions', 'files', 'activity'];
const META_FILE = path.join(DATA_DIR, 'meta.json');

let data = null;
let meta = null;

const fileOf = (name) => path.join(DATA_DIR, `${name}.json`);

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function writeAtomic(file, value) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

function exists() {
  return fs.existsSync(META_FILE) && COLLECTIONS.every((c) => fs.existsSync(fileOf(c)));
}

function load() {
  ensureDirs();
  meta = JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
  data = Object.fromEntries(COLLECTIONS.map((c) => [c, JSON.parse(fs.readFileSync(fileOf(c), 'utf8'))]));
}

function reset() {
  ensureDirs();
  for (const f of fs.readdirSync(UPLOAD_DIR)) fs.rmSync(path.join(UPLOAD_DIR, f), { force: true });
  data = Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
  meta = { seq: {}, createdAt: new Date().toISOString(), schemaVersion: 1 };
}

function save(...names) {
  const targets = names.length ? names : COLLECTIONS;
  for (const c of targets) writeAtomic(fileOf(c), data[c]);
  meta.updatedAt = new Date().toISOString();
  writeAtomic(META_FILE, meta);
}

function nextId(prefix) {
  meta.seq[prefix] = (meta.seq[prefix] || 0) + 1;
  return `${prefix}${meta.seq[prefix]}`;
}

function stats() {
  const files = COLLECTIONS.map((c) => {
    const f = fileOf(c);
    return { name: `${c}.json`, records: data[c].length, bytes: fs.existsSync(f) ? fs.statSync(f).size : 0 };
  });
  const uploads = fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR) : [];
  const uploadBytes = uploads.reduce((sum, f) => sum + fs.statSync(path.join(UPLOAD_DIR, f)).size, 0);
  return { dataDir: DATA_DIR, uploadDir: UPLOAD_DIR, files, uploads: uploads.length, uploadBytes, meta };
}

module.exports = {
  COLLECTIONS, exists, load, reset, save, nextId, stats,
  get data() { return data; },
  exportAll: () => ({ exportedAt: new Date().toISOString(), meta, ...data }),
};
