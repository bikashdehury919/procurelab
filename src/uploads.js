// File uploads are written to data/uploads and registered in data/files.json.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { UPLOAD_DIR, MAX_UPLOAD_MB, ALLOWED_EXTENSIONS } = require('./config');

const storage = multer.diskStorage({
  destination: (req, file, cb) => { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); cb(null, UPLOAD_DIR); },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
});

const upload = multer({
  storage,
  defParamCharset: 'utf8', // keep non-ASCII file names such as "Øresund.pdf" intact
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (!file.originalname) return cb(null, false); // empty file input
    const ok = ALLOWED_EXTENSIONS.includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : Object.assign(new Error('type'), { code: 'BAD_TYPE' }), ok);
  },
});

// Wraps multer so validation errors become a value on req instead of a crash.
function acceptFiles(field) {
  const handler = upload.array(field, 5);
  return (req, res, next) => handler(req, res, (err) => {
    req.uploadError = null;
    if (err) {
      req.uploadError = err.code === 'LIMIT_FILE_SIZE' ? 'size' : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? 'count' : err.code === 'BAD_TYPE' ? 'type' : 'other';
      for (const f of req.files || []) fs.rmSync(f.path, { force: true });
      req.files = [];
    }
    req.files = req.files || [];
    next();
  });
}

const originalName = (f) => path.basename(f.originalname).slice(0, 200);

const discard = (files) => { for (const f of files || []) fs.rmSync(f.path, { force: true }); };

module.exports = { acceptFiles, originalName, discard };
