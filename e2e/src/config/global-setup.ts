import { request, type FullConfig } from '@playwright/test';
import { env } from './env';

/**
 * Runs once before all tests:
 * 1. Waits until ProcureLab answers /api/health (free hosting tiers sleep; CI starts the app just before).
 * 2. Fails fast with a clear message if the test API token is wrong, instead of 50 confusing test failures.
 */
export default async function globalSetup(_config: FullConfig) {
  const ctx = await request.newContext({ baseURL: env.baseUrl });
  const deadline = Date.now() + 90_000;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const res = await ctx.get('/api/health', { timeout: 10_000 });
      if (res.ok()) break;
      lastError = `HTTP ${res.status()}`;
    } catch (e) {
      lastError = (e as Error).message;
    }
    await new Promise((r) => setTimeout(r, 3_000));
  }
  if (Date.now() >= deadline) throw new Error(`ProcureLab not reachable at ${env.baseUrl}/api/health: ${lastError}`);

  const probe = await ctx.get('/api/stats', { headers: { 'x-test-token': env.testApiToken } });
  if (probe.status() === 401) throw new Error('TEST_API_TOKEN is wrong for this environment (401 from /api/stats).');
  if (probe.status() === 503) throw new Error('The test API is disabled on this environment (TEST_API_TOKEN not set on the server).');
  await ctx.dispose();
  console.log(`[global-setup] ${env.name} ready at ${env.baseUrl} (run ${env.runId})`);
}
