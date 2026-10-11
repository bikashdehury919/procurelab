import { defineConfig, devices, type ReporterDescription } from '@playwright/test';
import { env } from './src/config/env';
import { MARKETS } from './src/config/markets';
import type { FixtureOptions } from './src/fixtures/test';

const CI = !!process.env.CI;

const reporters: ReporterDescription[] = [
  [CI ? 'dot' : 'list'],
  ['html', { outputFolder: 'reports/html', open: 'never' }],
  ['json', { outputFile: 'reports/results.json' }], // consumed by Testiny upload, summary and email
  ['junit', { outputFile: 'reports/junit.xml' }],
];
// Blob reports are merged across market jobs and shards; BLOB_NAME keeps file names unique per job.
if (CI) reporters.push(['blob', { outputDir: 'reports/blob', fileName: `report-${process.env.BLOB_NAME ?? 'job'}.zip` }]);

export default defineConfig<FixtureOptions>({
  testDir: './tests',
  outputDir: 'test-results',
  globalSetup: require.resolve('./src/config/global-setup'),
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0, // one retry in CI; a test that passes on retry is reported as "flaky", not hidden
  workers: env.workers,
  reporter: reporters,
  use: {
    baseURL: env.baseUrl,
    testIdAttribute: 'data-testid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    // 1. Sign in once per role through the API and save the session (no browser needed).
    { name: 'setup', testMatch: /auth\.setup\.ts/ },

    // 2. Smoke: the same @smoke specs run once per market, in parallel.
    ...MARKETS.map((market) => ({
      name: `smoke-${market}`,
      testDir: './tests/smoke',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], market },
    })),

    // 3. Regression: full functional coverage, default market NL (specs can override with test.use).
    { name: 'regression', testDir: './tests/regression', dependencies: ['setup'], use: { ...devices['Desktop Chrome'], market: 'NL' } },

    // 4. API checks: no browser, very fast; also the pipeline's first gate.
    { name: 'api', testDir: './tests/api' },
  ],
});
