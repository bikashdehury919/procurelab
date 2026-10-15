import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import type { Lang, MarketCode } from '../config/markets';

/** Project detail: requirements, assigned vendors, RFP list, archive/restore. */
export class ProjectPage extends BasePage {
  readonly title: Locator;
  readonly status: Locator;
  readonly requirementNames: Locator;
  readonly rfpLinks: Locator;
  readonly assignedVendors: Locator;

  constructor(page: Page, market: MarketCode, lang?: Lang) {
    super(page, market, lang);
    this.title = page.getByTestId('project-title');
    this.status = page.getByTestId('project-status').first();
    this.requirementNames = page.getByTestId('requirement-name');
    this.rfpLinks = page.getByTestId('rfp-link');
    this.assignedVendors = page.getByTestId('assigned-vendor');
  }

  async goto(projectId: string) {
    await this.open(`/projects/${projectId}`);
  }

  async addRequirement(name: string, priority: 'must' | 'should' | 'could' = 'must') {
    await this.page.getByTestId('input-reqName').fill(name);
    await this.page.getByTestId('input-reqPriority').selectOption(priority);
    await this.page.getByTestId('add-requirement').click();
  }

  async assignVendor(vendorName: string) {
    await this.page.getByTestId('assign-form').getByTestId('input-vendorId').selectOption({ label: vendorName });
    await this.page.getByTestId('assign-vendor').click();
  }

  async archive() {
    await this.page.getByTestId('archive-project').click();
  }
  async restore() {
    await this.page.getByTestId('restore-project').click();
  }
  async edit() {
    await this.page.getByTestId('edit-project').click();
  }
  async newRfp() {
    await this.page.getByTestId('new-rfp').click();
  }
  async openRfp(title: string) {
    await this.rfpLinks.filter({ hasText: title }).click();
  }
}
