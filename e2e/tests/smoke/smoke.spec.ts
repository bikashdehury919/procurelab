import { test, expect } from '../../src/fixtures/test';
import { env } from '../../src/config/env';
import { authFile, testData } from '../../src/config/markets';

/**
 * Smoke suite: runs once per market (projects smoke-NL, smoke-BE, smoke-DK, smoke-DE).
 * Goal: "is this market usable?" in under 2 minutes. Read-mostly; anything created is cleaned up.
 */
test.describe('Smoke', { tag: '@smoke' }, () => {
  test(
    'SMK-01 buyer signs in through the UI in the market language',
    { annotation: { type: 'id', description: 'SMK-01' } },
    async ({ loginPage, page, marketConfig }) => {
      await loginPage.goto();
      await expect(page.locator('html')).toHaveAttribute('lang', marketConfig.defaultLang);
      await loginPage.login(testData.accounts.buyer, env.demoPassword);
      await expect(page).toHaveURL(/\/dashboard/);
      await loginPage.expectMarket();
    },
  );

  test.describe('as procurement manager', () => {
    test.use({ storageState: authFile('buyer') });

    test(
      'SMK-02 dashboard shows KPIs, activity and market settings',
      { annotation: { type: 'id', description: 'SMK-02' } },
      async ({ dashboardPage, market, marketConfig: cfg }) => {
        await dashboardPage.goto();
        await dashboardPage.expectMarket();
        for (const kpi of ['projects', 'active-rfps', 'proposals', 'vendors'] as const) {
          await expect(dashboardPage.kpi(kpi)).toBeVisible();
          expect(await dashboardPage.kpiValue(kpi), `${kpi} KPI`).toBeGreaterThan(0);
        }
        await expect(dashboardPage.activityItems.first()).toBeVisible();
        await expect(dashboardPage.footer).toContainText(`${market} | ${cfg.defaultLang}-${market} | ${cfg.currency}`);
      },
    );

    test(
      "SMK-03 projects list shows the market's projects",
      { annotation: { type: 'id', description: 'SMK-03' } },
      async ({ projectsPage, projectPage, seeded }) => {
        await projectsPage.goto();
        await expect(projectsPage.row(seeded.project)).toBeVisible();
        await projectsPage.openProject(seeded.project);
        await expect(projectPage.title).toHaveText(seeded.project);
        await expect(projectPage.requirementNames.first()).toBeVisible();
      },
    );

    test('SMK-04 vendor directory filters by expertise', { annotation: { type: 'id', description: 'SMK-04' } }, async ({ vendorsPage, seeded }) => {
      await vendorsPage.goto();
      await vendorsPage.filter({ expertise: 'security' });
      await expect(vendorsPage.links.filter({ hasText: seeded.securityVendor })).toBeVisible();
      await expect(vendorsPage.empty).toHaveCount(0);
    });

    test(
      'SMK-05 create a project end to end',
      { annotation: { type: 'id', description: 'SMK-05' } },
      async ({ projectsPage, projectPage, data, api, market }) => {
        const input = data.project();
        try {
          await projectsPage.gotoNew();
          await projectsPage.fillForm(input);
          await projectsPage.save();
          await expect(projectPage.title).toHaveText(input.name);
          await expect(projectPage.flash).toBeVisible();
        } finally {
          await api.deleteProjectByName(market, input.name);
        }
      },
    );

    test(
      'SMK-06 proposal prices use the market currency and VAT',
      { annotation: { type: 'id', description: 'SMK-06' } },
      async ({ projectsPage, projectPage, rfpPage, seeded, api, marketConfig: cfg }) => {
        await projectsPage.goto();
        await projectsPage.openProject(seeded.project);
        await projectPage.openRfp(seeded.rfpWithProposals);
        await expect(rfpPage.title).toHaveText(seeded.rfpWithProposals);

        const { proposals } = await api.getRfp(await rfpPage.id());
        expect(proposals.length).toBeGreaterThan(0);
        for (const p of proposals) {
          await rfpPage.expectProposalPricing(p, cfg);
          expect(p.gross).toBeCloseTo(p.priceNet * (1 + cfg.vatRate), 2);
        }
      },
    );

    test(
      'SMK-07 language can be switched to English in this market',
      { annotation: { type: 'id', description: 'SMK-07' } },
      async ({ dashboardPage, page, market }) => {
        await dashboardPage.goto();
        await dashboardPage.header.switchLanguage('en');
        await expect(page.locator('body')).toHaveAttribute('data-locale', `en-${market}`);
        await expect(dashboardPage.header.nav('projects')).toHaveText('Projects');
      },
    );
  });

  test.describe('as vendor', () => {
    test.use({ storageState: async ({ market }, use) => use(authFile(`vendor-${market}`)) });

    test(
      'SMK-08 vendor sees an open RFP with requirements and documents',
      { annotation: { type: 'id', description: 'SMK-08' } },
      async ({ portalPage, seeded }) => {
        await portalPage.goto();
        await expect(await portalPage.companyName()).toHaveText(seeded.vendorCompany);
        const row = portalPage.invitation(seeded.vendorOpenRfp);
        await expect(row.getByTestId('invitation-status')).toHaveAttribute('data-status', 'awaiting');
        await portalPage.openRfp(seeded.vendorOpenRfp);
        await expect(portalPage.requirements.first()).toBeVisible();
        await expect(portalPage.documents.first()).toBeVisible();
      },
    );
  });
});
