import path from 'node:path';
import { test, expect } from '../../src/fixtures/test';
import { authFile, testData } from '../../src/config/markets';
import { VendorPortalPage } from '../../src/pages';

const FILES = path.resolve(__dirname, '../../test-data/files');
test.use({ storageState: authFile('buyer') });

test.describe('RFP lifecycle', { tag: '@regression' }, () => {
  test(
    'REG-RFP-01 send an RFP with an attachment',
    { annotation: { type: 'id', description: 'REG-RFP-01' } },
    async ({ seed, rfpFormPage, rfpPage, seeded, data }) => {
      const { project, requirements } = await seed.project({ requirements: 2 });
      const title = `RFP ${data.tag()}`;
      await rfpFormPage.goto(project.id);
      await rfpFormPage.fill({
        title,
        requirements: requirements.map((r) => r.name),
        vendors: [seeded.vendorCompany],
        deadline: data.futureDate(14),
        files: [path.join(FILES, 'rfp-scope.pdf')],
      });
      await rfpFormPage.send();
      await expect(rfpPage.title).toHaveText(title);
      await expect(rfpPage.flash).toBeVisible();
      await expect(rfpPage.files).toHaveText(['rfp-scope.pdf']);
    },
  );

  test(
    'REG-RFP-02 disallowed file types are rejected',
    { annotation: { type: 'id', description: 'REG-RFP-02' } },
    async ({ seed, rfpFormPage, seeded, data }) => {
      const { project, requirements } = await seed.project({ requirements: 1 });
      await rfpFormPage.goto(project.id);
      await rfpFormPage.fill({
        title: `RFP ${data.tag()}`,
        requirements: [requirements[0]!.name],
        vendors: [seeded.vendorCompany],
        deadline: data.futureDate(14),
        files: [path.join(FILES, 'not-allowed.exe')],
      });
      await rfpFormPage.send();
      await expect(rfpFormPage.uploadError).toBeVisible();
    },
  );

  test(
    'REG-RFP-03 vendor responds, buyer compares, analyzes and selects',
    { annotation: { type: 'id', description: 'REG-RFP-03' } },
    async ({ seed, api, market, rfpPage, page, pageAs, seeded, appConfig }) => {
      const cfg = appConfig.markets.find((m) => m.code === market)!;
      const t = (await api.i18n()).strings[cfg.defaultLang]!;
      const vendors = await api.listVendors(market);
      const portalCompany = vendors.find((v) => v.name === seeded.vendorCompany)!;
      const competitor = vendors.find((v) => v.id !== portalCompany.id)!;
      const { rfp } = await seed.rfp({ vendorIds: [portalCompany.id, competitor.id] });

      await test.step('competitor submits through the API (no document)', async () => {
        await api.submitProposal(rfp.id, { vendorId: competitor.id, priceNet: 120_000, deliveryMonths: 9 });
      });

      await test.step('vendor submits through the portal with a document', async () => {
        const vendorPage = new VendorPortalPage(await pageAs(`vendor-${market}`), market);
        await vendorPage.gotoRfp(rfp.id);
        await vendorPage.submitProposal({ priceNet: 95_000, deliveryMonths: 6, files: [path.join(FILES, 'rfp-scope.pdf')] });
        await expect(vendorPage.flash).toBeVisible();
        await expect(vendorPage.yourPrice).toBeVisible();
      });

      await test.step('buyer compares and sees the analyzer verdict', async () => {
        await rfpPage.goto(rfp.id);
        await expect(rfpPage.proposalRows).toHaveCount(2);
        await rfpPage.sortBy('price');
        expect(await rfpPage.vendorsInOrder()).toEqual([portalCompany.name, competitor.name]);
        if (cfg.flags.aiAnalyzer) {
          await expect(rfpPage.analysis(portalCompany.name).getByTestId('analysis-missing')).toHaveText(t.completeInfo!);
          await expect(rfpPage.analysis(competitor.name).getByTestId('analysis-missing')).toContainText(t.missing_document!);
          await expect(rfpPage.analysis(competitor.name).getByTestId('analysis-risk')).not.toHaveAttribute('data-status', 'risk-low');
        }
        await rfpPage.compare([portalCompany.name, competitor.name]);
        await expect(page.getByTestId('compare-vendor')).toHaveCount(2);
      });

      await test.step('buyer selects the vendor; the other proposal is not selected', async () => {
        await rfpPage.goto(rfp.id);
        await rfpPage.select(portalCompany.name);
        await expect(rfpPage.status).toHaveAttribute('data-status', 'awarded');
        await expect(rfpPage.proposal(portalCompany.name).getByTestId('proposal-status')).toHaveAttribute('data-status', 'awarded');
        await expect(rfpPage.proposal(competitor.name).getByTestId('proposal-status')).toHaveAttribute('data-status', 'rejected');
      });
    },
  );
});

test.describe('Vendor portal rules', { tag: '@regression' }, () => {
  test.use({ storageState: async ({ market }, use) => use(authFile(`vendor-${market}`)) });

  test('REG-VND-01 a second proposal for the same RFP is refused', { annotation: { type: 'id', description: 'REG-VND-01' } }, async ({ seed, portalPage }) => {
    const { rfp } = await seed.rfp();
    await portalPage.gotoRfp(rfp.id);
    await portalPage.submitProposal({ priceNet: 50_000, deliveryMonths: 3 });
    await expect(portalPage.yourPrice).toBeVisible();
    // Replay the form post directly: the server must refuse it, not only the UI.
    const res = await portalPage.page.request.post(`/portal/rfps/${rfp.id}/proposal`, { multipart: { priceNet: '1', deliveryMonths: '1' } });
    expect(res.status()).toBe(409);
  });

  test('REG-VND-02 a closed RFP no longer accepts proposals', { annotation: { type: 'id', description: 'REG-VND-02' } }, async ({ seed, portalPage, data }) => {
    const { rfp } = await seed.rfp({ deadline: data.pastDate(2) });
    await portalPage.gotoRfp(rfp.id);
    await expect(portalPage.closedNotice).toBeVisible();
    await expect(portalPage.page.getByTestId('proposal-form')).toHaveCount(0);
  });

  test(
    'REG-VND-03 vendors cannot open RFPs they are not invited to, or buyer pages',
    { annotation: { type: 'id', description: 'REG-VND-03' } },
    async ({ seed, api, market, portalPage, page }) => {
      const other = (await api.listVendors(market)).find((v) => v.name !== testData.seeded[market].vendorCompany)!;
      const { rfp } = await seed.rfp({ vendorIds: [other.id] });
      await portalPage.gotoRfp(rfp.id);
      await expect(page.getByTestId('not-found')).toBeVisible();
      const res = await page.goto('/dashboard');
      expect(res?.status()).toBe(403);
    },
  );
});
