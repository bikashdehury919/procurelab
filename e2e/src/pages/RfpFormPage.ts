import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import type { Lang, MarketCode } from '../config/markets';

export interface RfpInput {
  title: string;
  requirements: string[];
  vendors: string[];
  deadline: string;
  files?: string[];
}

export class RfpFormPage extends BasePage {
  readonly uploadError: Locator;

  constructor(page: Page, market: MarketCode, lang?: Lang) {
    super(page, market, lang);
    this.uploadError = page.getByTestId('upload-error');
  }

  async goto(projectId: string) {
    await this.open(`/projects/${projectId}/rfps/new`);
  }

  async fill(rfp: Partial<RfpInput>) {
    if (rfp.title !== undefined) await this.page.getByTestId('input-title').fill(rfp.title);
    for (const name of rfp.requirements ?? []) await this.page.getByTestId('group-requirementIds').getByLabel(name).check();
    // Vendors assigned to the project are pre-ticked; only tick the ones asked for.
    for (const name of rfp.vendors ?? []) await this.page.getByTestId('group-vendorIds').getByLabel(name).check();
    if (rfp.deadline !== undefined) await this.page.getByTestId('input-deadline').fill(rfp.deadline);
    if (rfp.files?.length) await this.page.getByTestId('input-attachments').setInputFiles(rfp.files);
  }

  async send() {
    await this.page.getByTestId('send-rfp').click();
  }

  fieldError(field: 'title' | 'requirementIds' | 'vendorIds' | 'deadline'): Locator {
    return this.page.getByTestId(`error-${field}`);
  }
}
