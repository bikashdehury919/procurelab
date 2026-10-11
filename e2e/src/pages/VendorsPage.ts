import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import type { Lang, MarketCode } from '../config/markets';

export class VendorsPage extends BasePage {
  readonly rows: Locator;
  readonly links: Locator;
  readonly empty: Locator;

  constructor(page: Page, market: MarketCode, lang?: Lang) {
    super(page, market, lang);
    this.rows = page.getByTestId('vendor-row');
    this.links = page.getByTestId('vendor-link');
    this.empty = page.getByTestId('vendors-empty');
  }

  async goto() {
    await this.open('/vendors');
  }
  async gotoNew() {
    await this.open('/vendors/new');
  }

  async filter({ q = '', expertise = '', minRating = '' }: { q?: string; expertise?: string; minRating?: string }) {
    await this.page.getByTestId('input-search').fill(q);
    await this.page.getByTestId('input-expertise').selectOption(expertise);
    await this.page.getByTestId('input-minRating').selectOption(minRating);
    await this.page.getByTestId('apply-filters').click();
  }

  async addVendor(v: {
    name: string;
    city: string;
    contact: string;
    contactEmail?: string;
    rating: number | string;
    certifications?: string[];
    expertise: string[];
  }) {
    await this.page.getByTestId('input-name').fill(v.name);
    await this.page.getByTestId('input-city').fill(v.city);
    await this.page.getByTestId('input-contact').fill(v.contact);
    if (v.contactEmail) await this.page.getByTestId('input-contactEmail').fill(v.contactEmail);
    await this.page.getByTestId('input-rating').fill(String(v.rating));
    if (v.certifications) await this.page.getByTestId('input-certifications').fill(v.certifications.join(', '));
    for (const e of v.expertise) await this.page.getByTestId(`check-expertise-${e}`).check();
    await this.page.getByTestId('save-vendor').click();
  }
}
