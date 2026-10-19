import { test, expect } from '../../src/fixtures/test';
import { authFile, shortDate } from '../../src/config/markets';
import { RfpPage } from '../../src/pages';

test.use({ storageState: authFile('buyer') });

/** ISO date (YYYY-MM-DD) plus n calendar days, in UTC like the app. */
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

test.describe('RFP deadline extension', { tag: '@regression' }, () => {
  test.describe('market with the feature on', () => {
    test(
      'RFP-EXT-01 buyer extends an open RFP deadline by 7 days',
      { annotation: { type: 'id', description: 'RFP-EXT-01' } },
      async ({ seed, api, page, market, marketConfig, data }) => {
        expect(marketConfig.flags.deadlineExtension, `deadlineExtension flag must be on in ${market}`).toBe(true);
        const lang = marketConfig.defaultLang;
        const t = (await api.i18n()).strings[lang]!;
        const deadline = data.futureDate(14);
        const { rfp } = await seed.rfp({ deadline });
        const rfpPage = new RfpPage(page, market, lang);

        await rfpPage.goto(rfp.id);
        await expect(rfpPage.extendForm).toBeVisible();
        await expect(rfpPage.deadline).toHaveAttribute('data-date', deadline);

        await rfpPage.extendDeadline(7);

        const extended = addDays(deadline, 7);
        const shown = shortDate(extended, lang, market);
        await expect(rfpPage.flash).toHaveText(t.deadlineExtended!.replace('{date}', shown));
        await expect(rfpPage.deadline).toHaveAttribute('data-date', extended);
        await expect(rfpPage.deadline).toHaveText(shown);
      },
    );

    test(
      'RFP-EXT-02 an extension outside 1 to 30 days is rejected',
      { annotation: { type: 'id', description: 'RFP-EXT-02' } },
      async ({ seed, api, page, market, marketConfig, data }) => {
        expect(marketConfig.flags.deadlineExtension, `deadlineExtension flag must be on in ${market}`).toBe(true);
        const lang = marketConfig.defaultLang;
        const t = (await api.i18n()).strings[lang]!;
        const deadline = data.futureDate(14);
        const { rfp } = await seed.rfp({ deadline });
        const rfpPage = new RfpPage(page, market, lang);

        await rfpPage.goto(rfp.id);
        await expect(rfpPage.extendForm).toBeVisible();

        for (const days of [0, 31]) {
          await test.step(`extend by ${days} days`, async () => {
            await rfpPage.extendDeadline(days);
            await expect(rfpPage.extendError).toHaveText(t.errExtendDays!);
            await expect(rfpPage.deadline).toHaveAttribute('data-date', deadline);
            await expect(rfpPage.deadline).toHaveText(shortDate(deadline, lang, market));
          });
        }
      },
    );
  });

  test.describe('market with the feature off', () => {
    test.use({ market: 'BE' });

    test(
      'RFP-EXT-03 the extension is not offered where the feature is off',
      { annotation: { type: 'id', description: 'RFP-EXT-03' } },
      async ({ seed, page, market, marketConfig, data }) => {
        expect(marketConfig.flags.deadlineExtension, `deadlineExtension flag must be off in ${market}`).toBe(false);
        const lang = marketConfig.defaultLang;
        const deadline = data.futureDate(14);
        const { rfp } = await seed.rfp({ deadline });
        const rfpPage = new RfpPage(page, market, lang);

        await rfpPage.goto(rfp.id);
        await expect(rfpPage.deadline).toHaveAttribute('data-date', deadline);
        await expect(rfpPage.deadline).toHaveText(shortDate(deadline, lang, market));
        await expect(rfpPage.extendForm).toHaveCount(0);
      },
    );
  });
});
