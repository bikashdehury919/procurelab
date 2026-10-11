import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import type { Lang, MarketCode } from '../config/markets';

export type Kpi = 'projects' | 'active-rfps' | 'proposals' | 'vendors';

export class DashboardPage extends BasePage {
  readonly activityItems: Locator;
  readonly footer: Locator;
  constructor(page: Page, market: MarketCode, lang?: Lang) {
    super(page, market, lang);
    this.activityItems = page.getByTestId('activity-item');
    this.footer = page.getByTestId('footer');
  }
  async goto() {
    await this.open('/dashboard');
  }
  kpi(name: Kpi): Locator {
    return this.page.getByTestId(`kpi-${name}`);
  }

  async kpiValue(name: Kpi): Promise<number> {
    return Number(await this.page.getByTestId(`kpi-${name}-value`).innerText());
  }
}
