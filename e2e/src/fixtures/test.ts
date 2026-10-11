import { test as base, expect, type Page } from '@playwright/test';
import { env } from '../config/env';
import { authFile, type AppConfig, type MarketCode, type Role, testData } from '../config/markets';
import { TestDataApi, type Project, type Requirement, type Rfp, type Vendor } from '../api/TestDataApi';
import { DataFactory } from '../data/DataFactory';
import * as P from '../pages';

/** Options set per Playwright project (see playwright.config.ts). */
export type FixtureOptions = { market: MarketCode };

type Seeder = {
  /** Project with N requirements, created through the API and deleted after the test. */
  project(opts?: { requirements?: number; status?: 'planning' | 'active' | 'completed' }): Promise<{ project: Project; requirements: Requirement[] }>;
  vendor(overrides?: Parameters<DataFactory['vendor']>[0]): Promise<Vendor>;
  /** Open RFP inviting the given vendors (default: the market's seeded vendor-login company). */
  rfp(opts?: { vendorIds?: string[]; deadline?: string }): Promise<{ project: Project; requirements: Requirement[]; rfp: Rfp }>;
  user(role: 'admin' | 'buyer' | 'vendor', overrides?: { vendorId?: string }): Promise<{ id: string; email: string; password: string; name: string }>;
};

type Fixtures = {
  api: TestDataApi;
  appConfig: AppConfig;
  data: DataFactory;
  seed: Seeder;
  /** Open an extra, independently signed-in page for another role (multi-role scenarios). */
  pageAs: (role: Role) => Promise<Page>;
  seeded: (typeof testData.seeded)[MarketCode];
  // Page objects bound to the current page and market
  loginPage: P.LoginPage;
  dashboardPage: P.DashboardPage;
  projectsPage: P.ProjectsPage;
  projectPage: P.ProjectPage;
  rfpFormPage: P.RfpFormPage;
  rfpPage: P.RfpPage;
  vendorsPage: P.VendorsPage;
  portalPage: P.VendorPortalPage;
  adminUsersPage: P.AdminUsersPage;
  /** Auto fixture: adds market and Testiny test key annotations to every test. */
  _traceability: void;
};

export const test = base.extend<Fixtures & FixtureOptions>({
  market: ['NL', { option: true }],

  _traceability: [
    async ({ market }, use, testInfo) => {
      testInfo.annotations.push({ type: 'market', description: market });
      const id = testInfo.annotations.find((a) => a.type === 'id')?.description;
      // One Testiny key per scenario and market, e.g. SMK-02-DK. Stable across runs and renames.
      if (id) testInfo.annotations.push({ type: 'testkey', description: `${id}-${market}` });
      await use();
    },
    { auto: true },
  ],

  api: async ({ request }, use) => {
    await use(new TestDataApi(request, env.testApiToken));
  },

  appConfig: async ({ api }, use) => {
    await use(await api.config());
  },

  data: async ({ market }, use, testInfo) => {
    await use(new DataFactory(market, testInfo.workerIndex));
  },

  seeded: async ({ market }, use) => {
    await use(testData.seeded[market]);
  },

  seed: async ({ api, data, market }, use) => {
    const cleanup: Array<() => Promise<unknown>> = [];
    const seeder: Seeder = {
      async project({ requirements = 2, status = 'active' } = {}) {
        const project = await api.createProject(data.project({ status }));
        cleanup.push(() => api.deleteProject(project.id));
        const reqs: Requirement[] = [];
        for (let i = 0; i < requirements; i++) reqs.push(await api.addRequirement(project.id, data.requirement(i === 0 ? 'must' : 'should')));
        return { project, requirements: reqs };
      },
      async vendor(overrides) {
        const v = await api.createVendor(data.vendor(overrides));
        cleanup.push(() => api.deleteVendor(v.id));
        return v;
      },
      async rfp({ vendorIds, deadline = data.futureDate(21) } = {}) {
        const { project, requirements } = await seeder.project({ requirements: 2 });
        const vendors = await api.listVendors(market);
        const defaultVendor = vendors.find((v) => v.name === testData.seeded[market].vendorCompany);
        if (!vendorIds && !defaultVendor) throw new Error(`Seeded vendor ${testData.seeded[market].vendorCompany} not found in ${market}`);
        const rfp = await api.createRfp(project.id, {
          title: `RFP ${data.tag()}`,
          requirementIds: requirements.map((r) => r.id),
          vendorIds: vendorIds ?? [defaultVendor!.id],
          deadline,
        });
        return { project, requirements, rfp }; // removed with its project
      },
      async user(role, overrides = {}) {
        const input = data.user(role, overrides);
        const u = await api.createUser(input);
        cleanup.push(() => api.deleteUser(u.id));
        return { id: u.id, email: u.email, password: input.password, name: u.name };
      },
    };
    await use(seeder);
    for (const fn of cleanup.reverse()) await fn().catch((e) => console.warn(`[cleanup] ${e}`));
  },

  pageAs: async ({ browser }, use) => {
    const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];
    await use(async (role) => {
      const ctx = await browser.newContext({ storageState: authFile(role), baseURL: env.baseUrl });
      contexts.push(ctx);
      return ctx.newPage();
    });
    for (const c of contexts) await c.close();
  },

  loginPage: async ({ page, market }, use) => use(new P.LoginPage(page, market)),
  dashboardPage: async ({ page, market }, use) => use(new P.DashboardPage(page, market)),
  projectsPage: async ({ page, market }, use) => use(new P.ProjectsPage(page, market)),
  projectPage: async ({ page, market }, use) => use(new P.ProjectPage(page, market)),
  rfpFormPage: async ({ page, market }, use) => use(new P.RfpFormPage(page, market)),
  rfpPage: async ({ page, market }, use) => use(new P.RfpPage(page, market)),
  vendorsPage: async ({ page, market }, use) => use(new P.VendorsPage(page, market)),
  portalPage: async ({ page, market }, use) => use(new P.VendorPortalPage(page, market)),
  adminUsersPage: async ({ page, market }, use) => use(new P.AdminUsersPage(page, market)),
});

export { expect };

/** Format money exactly like the app does (language + market region, market currency). */
export function money(amount: number, lang: string, market: MarketCode, currency: string): string {
  return new Intl.NumberFormat(`${lang}-${market}`, { style: 'currency', currency }).format(amount);
}
