import { test, expect } from '../../src/fixtures/test';
import { MARKETS } from '../../src/config/markets';

test.describe('API', { tag: ['@api', '@smoke'] }, () => {
  test('API-01 health endpoint is up', { annotation: { type: 'id', description: 'API-01' } }, async ({ api }) => {
    expect((await api.health()).status).toBe('ok');
  });

  test('API-02 config exposes all 4 markets with VAT and currency', { annotation: { type: 'id', description: 'API-02' } }, async ({ appConfig }) => {
    expect(appConfig.markets.map((m) => m.code)).toEqual([...MARKETS]);
    const vat = Object.fromEntries(appConfig.markets.map((m) => [m.code, m.vatRate]));
    expect(vat).toEqual({ NL: 0.21, BE: 0.21, DK: 0.25, DE: 0.19 });
    expect(appConfig.markets.find((m) => m.code === 'DK')!.currency).toBe('DKK');
  });

  test('API-03 test data API rejects requests without a token', { annotation: { type: 'id', description: 'API-03' } }, async ({ request }) => {
    expect((await request.post('/api/test/reset')).status()).toBe(401);
  });

  test('API-04 project lifecycle through the API, with locale data', { annotation: { type: 'id', description: 'API-04' } }, async ({ api, data, market }) => {
    const input = data.project();
    const p = await api.createProject(input);
    try {
      expect(p).toMatchObject({ name: input.name, market, budget: input.budget });
      expect((await api.listProjects(market)).some((x) => x.id === p.id)).toBe(true);
    } finally {
      await api.deleteProject(p.id);
    }
    expect((await api.listProjects(market)).some((x) => x.id === p.id)).toBe(false);
  });
});
