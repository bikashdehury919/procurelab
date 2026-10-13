import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import type { Lang, MarketCode } from '../config/markets';

/** Vendor portal: My RFPs list and the RFP response page (documents, questions, proposal). */
export class VendorPortalPage extends BasePage {
  readonly invitationRows: Locator;
  readonly requirements: Locator;
  readonly documents: Locator;
  readonly proposalError: Locator;
  readonly closedNotice: Locator;
  readonly yourPrice: Locator;
  readonly yourGross: Locator;
  readonly vatAmount: Locator;
  readonly grossAmount: Locator;

  constructor(page: Page, market: MarketCode, lang?: Lang) {
    super(page, market, lang);
    this.invitationRows = page.getByTestId('invitation-row');
    this.requirements = page.getByTestId('requirement-item');
    this.documents = page.getByTestId('file-link');
    this.proposalError = page.getByTestId('proposal-error');
    this.closedNotice = page.getByTestId('rfp-closed');
    this.yourPrice = page.getByTestId('your-price');
    this.yourGross = page.getByTestId('your-gross');
    this.vatAmount = page.getByTestId('vat-amount');
    this.grossAmount = page.getByTestId('gross-amount');
  }

  async goto() {
    await this.open('/portal');
  }

  /** Company name under the title, found through the Locator Hub (self-healing). */
  async companyName(): Promise<Locator> {
    return this.hub.find('portal.vendorCompany');
  }

  async gotoRfp(rfpId: string) {
    await this.open(`/portal/rfps/${rfpId}`);
  }

  invitation(title: string): Locator {
    return this.invitationRows.filter({ has: this.page.getByTestId('invitation-link').getByText(title, { exact: true }) });
  }

  async openRfp(title: string) {
    await this.invitation(title).getByTestId('invitation-link').click();
  }

  async askQuestion(text: string) {
    await this.page.getByTestId('input-question').fill(text);
    await this.page.getByTestId('send-question').click();
  }

  async submitProposal(p: { priceNet: number | string; deliveryMonths: number | string; note?: string; files?: string[] }) {
    await this.page.getByTestId('input-priceNet').fill(String(p.priceNet));
    await this.page.getByTestId('input-deliveryMonths').fill(String(p.deliveryMonths));
    if (p.files?.length) await this.page.getByTestId('input-documents').setInputFiles(p.files);
    if (p.note) await this.page.getByTestId('input-note').fill(p.note);
    await (await this.hub.find('portal.submitProposal')).click();
  }
}
