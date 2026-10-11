import { test as setup, expect } from '@playwright/test';
import { env } from '../src/config/env';
import { authFile, emailFor, MARKETS, type Role } from '../src/config/markets';

const ROLES: Role[] = ['admin', 'buyer', ...MARKETS.map((m) => `vendor-${m}` as const)];

// API login (form POST) is ~50x faster than UI login and has no browser dependency.
// The UI login itself is covered by the smoke test SMK-01.
for (const role of ROLES) {
  setup(`authenticate ${role}`, async ({ request }) => {
    const res = await request.post('/login', { form: { email: emailFor(role), password: env.demoPassword }, maxRedirects: 0 });
    expect(res.status(), `login for ${role} should redirect`).toBe(302);
    await request.storageState({ path: authFile(role) });
  });
}
