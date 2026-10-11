const path = require('path');

const PROD = process.env.NODE_ENV === 'production';
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));

module.exports = {
  PROD,
  ROOT,
  APP_NAME: process.env.APP_NAME || 'ProcureLab',
  PORT: Number(process.env.PORT) || 3000,
  SESSION_SECRET: process.env.SESSION_SECRET || 'dev-only-secret',
  DEMO_PASSWORD: process.env.DEMO_PASSWORD || 'Demo123!',
  TEST_API_TOKEN: process.env.TEST_API_TOKEN || (PROD ? null : 'local-test-token'),
  ALLOW_FLAG_OVERRIDES: (process.env.ALLOW_FLAG_OVERRIDES ?? 'true') !== 'false',
  DATA_DIR,
  UPLOAD_DIR: path.join(DATA_DIR, 'uploads'),
  MAX_UPLOAD_MB: Number(process.env.MAX_UPLOAD_MB) || 5,
  ALLOWED_EXTENSIONS: ['.pdf', '.docx', '.xlsx', '.pptx', '.txt', '.csv', '.png', '.jpg', '.jpeg'],
};
