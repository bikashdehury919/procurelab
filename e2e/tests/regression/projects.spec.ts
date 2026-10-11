import { test, expect } from '../../src/fixtures/test';
import { authFile } from '../../src/config/markets';

test.use({ storageState: authFile('buyer') });

test.describe('Projects', { tag: '@regression' }, () => {
  test('REG-PRJ-01 mandatory fields are validated', { annotation: { type: 'id', description: 'REG-PRJ-01' } }, async ({ projectsPage, page }) => {
    await projectsPage.gotoNew();
    await projectsPage.save();
    await expect(page).toHaveURL(/\/projects$/); // stays on the form (422), no redirect
    for (const f of ['name', 'owner', 'budget', 'startDate', 'endDate'] as const) await expect(projectsPage.fieldError(f)).toBeVisible();
  });

  test('REG-PRJ-02 end date before start date is rejected', { annotation: { type: 'id', description: 'REG-PRJ-02' } }, async ({ projectsPage, data }) => {
    const p = data.project();
    await projectsPage.gotoNew();
    await projectsPage.fillForm({ ...p, startDate: data.futureDate(30), endDate: data.futureDate(10) });
    await projectsPage.save();
    await expect(projectsPage.fieldError('endDate')).toBeVisible();
    await expect(projectsPage.fieldError('name')).toHaveCount(0);
  });

  test(
    'REG-PRJ-03 duplicate project names are rejected within a market',
    { annotation: { type: 'id', description: 'REG-PRJ-03' } },
    async ({ projectsPage, seed, data }) => {
      const { project } = await seed.project();
      await projectsPage.gotoNew();
      await projectsPage.fillForm({ ...data.project(), name: project.name });
      await projectsPage.save();
      await expect(projectsPage.fieldError('name')).toBeVisible();
    },
  );

  test('REG-PRJ-04 search and status filter', { annotation: { type: 'id', description: 'REG-PRJ-04' } }, async ({ projectsPage, seed }) => {
    const { project: planning } = await seed.project({ status: 'planning' });
    const { project: active } = await seed.project({ status: 'active' });
    await projectsPage.goto();
    await projectsPage.filter({ q: planning.name });
    await expect(projectsPage.links).toHaveText([planning.name]);
    await projectsPage.filter({ q: active.name, status: 'planning' });
    await expect(projectsPage.empty).toBeVisible();
  });

  test(
    'REG-PRJ-05 archive hides a project, restore brings it back',
    { annotation: { type: 'id', description: 'REG-PRJ-05' } },
    async ({ projectsPage, projectPage, seed }) => {
      const { project } = await seed.project();
      await projectPage.goto(project.id);
      await projectPage.archive();
      await expect(projectsPage.row(project.name)).toHaveCount(0);
      await projectsPage.filter({ status: 'archived' });
      await expect(projectsPage.row(project.name)).toBeVisible();
      await projectPage.goto(project.id);
      await projectPage.restore();
      await expect(projectPage.status).toHaveAttribute('data-status', 'active');
    },
  );

  test(
    'REG-PRJ-06 an RFP needs at least one requirement',
    { annotation: { type: 'id', description: 'REG-PRJ-06' } },
    async ({ seed, projectPage, rfpFormPage, page }) => {
      const { project } = await seed.project({ requirements: 0 });
      await rfpFormPage.goto(project.id);
      await expect(page.getByTestId('no-requirements')).toBeVisible();
      await projectPage.goto(project.id);
      await projectPage.addRequirement('Penetration test', 'must');
      await expect(projectPage.requirementNames).toHaveText(['Penetration test']);
    },
  );
});
