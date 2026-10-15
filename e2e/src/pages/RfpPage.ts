import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { money, type Lang, type MarketCode, type MarketConfig } from '../config/markets';

/** Buyer view of an RFP: proposal comparison, AI Proposal Analyzer, invited vendors, questions, files. */
export class RfpPage extends BasePage {
  readonly title: Locator;
  readonly status: Locator;
  readonly proposalRows: Locator;
  readonly analysisRows: Locator;
  readonly analyzer: Locator;
  readonly files: Locator;
  readonly questions: Locator;
  readonly notice: Locator;

  constructor(page: Page, market: MarketCode, lang?: Lang) {
    super(page, market, lang);
    this.title = page.getByTestId('rfp-title');
    this.status = page.getByTestId('rfp-status').first();
    this.proposalRows = page.getByTestId('proposal-row');
    this.analysisRows = page.getByTestId('analysis-row');
    this.analyzer = page.getByTestId('analyzer');
    this.files = page.getByTestId('file-link');
    this.questions = page.getByTestId('question-text');
    this.notice = page.getByTestId('notice');
  }

  async goto(rfpId: string, query = '') {
    await this.open(`/rfps/${rfpId}${query}`);
  }

  /** Id of the RFP currently open, read from the URL (/rfps/r12). */
  async id(): Promise<string> {
    await expect(this.page).toHaveURL(/\/rfps\/r\d+/);
    const match = /\/rfps\/(r\d+)/.exec(this.page.url());
    if (!match?.[1]) throw new Error(`Not on an RFP page: ${this.page.url()}`);
    return match[1];
  }

  proposal(vendor: string): Locator {
    return this.page.locator(`[data-testid="proposal-row"][data-vendor="${vendor}"]`);
  }
  proposalById(id: string): Locator {
    return this.page.locator(`[data-testid="proposal-row"][data-proposal-id="${id}"]`);
  }
  analysis(vendor: string): Locator {
    return this.page.locator(`[data-testid="analysis-row"][data-vendor="${vendor}"]`);
  }

  /** Net price is always shown; the gross column only when the market's vatBreakdown flag is on. */
  async expectProposalPricing(p: { id: string; priceNet: number; gross: number }, cfg: MarketConfig) {
    const row = this.proposalById(p.id);
    const fmt = (amount: number) => money(amount, cfg.defaultLang, this.market, cfg.currency);
    await expect(row.getByTestId('proposal-price')).toHaveText(fmt(p.priceNet));
    if (cfg.flags.vatBreakdown) await expect(row.getByTestId('proposal-gross')).toHaveText(fmt(p.gross));
    else await expect(row.getByTestId('proposal-gross')).toHaveCount(0);
  }

  async vendorsInOrder(): Promise<string[]> {
    return this.proposalRows.evaluateAll((rows) => rows.map((r) => r.getAttribute('data-vendor') ?? ''));
  }

  async sortBy(column: 'price' | 'delivery' | 'rating') {
    await this.page.getByTestId(`sort-${column}`).click();
  }
  async filterMinRating(value: '' | '3' | '3.5' | '4' | '4.5') {
    await this.page.getByTestId('input-minRating').selectOption(value);
    await expect(this.page).toHaveURL(new RegExp(`minRating=${value.replace('.', '\\.')}`));
  }

  async compare(vendors: string[]) {
    for (const v of vendors) await this.proposal(v).getByTestId('compare-check').check();
    await this.page.getByTestId('compare-selected').click();
  }

  async select(vendor: string) {
    await this.proposal(vendor).getByTestId('select-proposal').click();
  }
  async reject(vendor: string) {
    await this.proposal(vendor).getByTestId('reject-proposal').click();
  }
  async generateAiSummary() {
    await this.page.getByTestId('generate-ai-summary').click();
  }
}
