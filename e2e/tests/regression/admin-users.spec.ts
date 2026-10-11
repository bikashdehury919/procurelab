import { test, expect } from '../../src/fixtures/test';
import { authFile } from '../../src/config/markets';
import { env } from '../../src/config/env';
import { LoginPage } from '../../src/pages';

test.describe('User administration', { tag: '@regression' }, () => {
  test.use({ storageState: authFile('admin') });

  test(
    'REG-ADM-01 admin creates a user who can sign in; deactivation signs them out',
    { annotation: { type: 'id', description: 'REG-ADM-01' } },
    async ({ adminUsersPage, data, api, browser, market }) => {
      const u = data.user('buyer');
      await adminUsersPage.goto();
      await adminUsersPage.createUser({ ...u, market });
      await expect(adminUsersPage.flash).toBeVisible();
      await expect(adminUsersPage.row(u.email)).toBeVisible();

      const ctx = await browser.newContext({ baseURL: env.baseUrl, storageState: { cookies: [], origins: [] } });
      try {
        const login = new LoginPage(await ctx.newPage(), market);
        await login.goto();
        await login.login(u.email, u.password);
        await expect(login.page).toHaveURL(/\/dashboard/);

        await adminUsersPage.deactivate(u.email);
        await expect(adminUsersPage.row(u.email).getByTestId('user-status')).toHaveAttribute('data-status', 'inactive');
        await login.page.reload();
        await expect(login.page).toHaveURL(/\/login/);
      } finally {
        await ctx.close();
        const created = (await api.listUsers()).find((x) => x.email === u.email);
        if (created) await api.deleteUser(created.id);
      }
    },
  );

  test('REG-ADM-02 procurement managers cannot open user administration', { annotation: { type: 'id', description: 'REG-ADM-02' } }, async ({ pageAs }) => {
    const buyer = await pageAs('buyer');
    const res = await buyer.goto('/admin/users');
    expect(res?.status()).toBe(403);
  });
});
