import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

/**
 * Loads the test settings for the chosen environment (TEST_ENV = local | ci | render).
 * Precedence: real environment variables (CI secrets) > e2e/.env (local secrets) > config/env/.env.<name> (profile).
 */
export type TestEnvName = 'local' | 'ci' | 'render';
const ENVS: readonly TestEnvName[] = ['local', 'ci', 'render'];

const name = (process.env.TEST_ENV ?? 'local') as TestEnvName;
if (!ENVS.includes(name)) throw new Error(`TEST_ENV must be one of ${ENVS.join(', ')}; got "${name}"`);

const root = path.resolve(__dirname, '../..');

// GitHub passes unset secrets as empty strings. Treat OUR empty settings as "not set" so the profile/.env can fill them in.
const SETTINGS = ['BASE_URL', 'TEST_API_TOKEN', 'DEMO_PASSWORD', 'WORKERS', 'FAKER_SEED', 'RUN_ID'] as const;
for (const key of SETTINGS) if (process.env[key] === '') delete process.env[key];

// dotenv never overrides a variable that is already set, which gives the precedence above.
dotenv.config({ path: path.join(root, '.env'), quiet: true });
dotenv.config({ path: path.join(root, 'config/env', `.env.${name}`), quiet: true });

function required(key: (typeof SETTINGS)[number]): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required setting ${key} for TEST_ENV=${name} (set it in config/env/.env.${name}, e2e/.env or the CI secrets)`);
  return value;
}

function url(key: (typeof SETTINGS)[number]): string {
  const value = required(key);
  try {
    return new URL(value).toString().replace(/\/$/, '');
  } catch {
    throw new Error(`${key} is not a valid URL: "${value}" (TEST_ENV=${name})`);
  }
}

function optionalInt(key: (typeof SETTINGS)[number]): number | undefined {
  const value = process.env[key];
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${key} must be a whole number >= 0; got "${value}"`);
  return n;
}

export const env = Object.freeze({
  name,
  baseUrl: url('BASE_URL'),
  testApiToken: process.env.TEST_API_TOKEN ?? '',
  demoPassword: process.env.DEMO_PASSWORD ?? 'Demo123!',
  workers: optionalInt('WORKERS') || undefined, // 0 or unset = let Playwright decide
  fakerSeed: optionalInt('FAKER_SEED'),
  /** Unique per pipeline run: used to tag (and find) the data a run creates. */
  runId: process.env.RUN_ID ?? process.env.GITHUB_RUN_ID ?? `local-${Date.now().toString(36)}`,
  testDataDir: path.join(root, 'test-data', name),
  authDir: path.join(root, '.auth'),
});

/** Reads test-data/<TEST_ENV>/<file> with a clear error when the file is missing or not valid JSON. */
export function loadTestData<T>(file: string): T {
  const fullPath = path.join(env.testDataDir, file);
  if (!fs.existsSync(fullPath)) throw new Error(`Test data file not found: ${fullPath} (TEST_ENV=${name})`);
  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8')) as T;
  } catch (e) {
    throw new Error(`Test data file is not valid JSON: ${fullPath}: ${(e as Error).message}`);
  }
}
