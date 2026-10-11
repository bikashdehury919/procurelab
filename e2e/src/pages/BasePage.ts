import { expect, type Locator, type Page } from '@playwright/test';
import type { Lang, MarketCode } from '../config/markets';
/** Shared header: navigation, market and language switchers, signed-in user. */
export class AppHeader {
  readonly marketSwitcher: Locator;
  readonly languageSwitcher: Locator;
  readonly userName: Locator;
  readonly userRole: Locator;
  readonly signOut: Locator;

  constructor(private readonly page: Page) {
    this.marketSwitcher = page.getByTestId('market-switcher');
    this.languageSwitcher = page.getByTestId('language-switcher');
    this.userName = page.getByTestId('user-name');
    this.userRole = page.getByTestId('user-role');
    this.signOut = page.getByTestId('sign-out');
  }
  nav(item: 'dashboard' | 'projects' | 'vendors' | 'users' | 'system' | 'myRfps'): Locator {
    return this.page.getByTestId(`nav-${item}`);
  }
  async switchMarket(market: MarketCode) {
    await this.marketSwitcher.selectOption(market);
    await expect(this.page.locator('body')).toHaveAttribute('data-market', market);
  }
  async switchLanguage(lang: Lang) {
    await this.languageSwitcher.selectOption(lang);
    await expect(this.page.locator('body')).toHaveAttribute('data-lang', lang);
  }
}
/**
* Every page object extends BasePage. It knows the market (and optional language) the test runs in,
* so `open('/projects')` always lands in the right market: the market is a test dimension, not a
step.
*/
export abstract class BasePage {
  readonly header: AppHeader;
  readonly flash: Locator;
  readonly body: Locator;
  constructor(
    readonly page: Page,
    readonly market: MarketCode,
    readonly lang?: Lang,
  ) {
    this.header = new AppHeader(page);
    this.flash = page.getByTestId('flash');
    this.body = page.locator('body');
  }
  protected async open(path: string) {
    const url = new URL(path, 'http://placeholder');
    url.searchParams.set('market', this.market);
    if (this.lang) url.searchParams.set('lang', this.lang);
    await this.page.goto(url.pathname + url.search);
  }
  async expectMarket(market: MarketCode = this.market) {
    await expect(this.body).toHaveAttribute('data-market', market);
  }
}
