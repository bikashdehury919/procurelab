import { test, expect } from '../../src/fixtures/test';
import { authFile } from '../../src/config/markets';

test.use({ storageState: authFile('buyer') });

test.describe('Translations', { tag: '@regression' }, () => {
  test('REG-I18N-01 every language defines every UI text', { annotation: { type: 'id', description: 'REG-I18N-01' } }, async ({ request }) => {
    const { missing } = await (await request.get('/api/i18n')).json();
    expect(missing).toEqual({ en: [], nl: [], da: [], de: [] });
  });

  test(
    'REG-I18N-02 German RFP form is fully translated',
    {
      annotation: [
        { type: 'id', description: 'REG-I18N-02' },
        { type: 'issue', description: 'PL-BUG-001: German "Send RFP" button is untranslated' },
      ],
    },
    async ({ seed, page }) => {
      // Known defect: marked as expected-to-fail so the suite stays green while the bug is open.
      // When someone fixes the label, this test "unexpectedly passes" and tells you to remove test.fail().
      test.fail(true, 'PL-BUG-001 open');
      const { project } = await seed.project();
      await page.goto(`/projects/${project.id}/rfps/new?market=NL&lang=de`);
      await expect(page.getByTestId('send-rfp')).toHaveText('Ausschreibung senden');
    },
  );
});
