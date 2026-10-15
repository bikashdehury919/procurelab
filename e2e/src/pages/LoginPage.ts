import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import type { Lang, MarketCode } from '../config/markets';
export class LoginPage extends BasePage {
  readonly error: Locator;
  constructor(page: Page, market: MarketCode, lang?: Lang) {
    super(page, market, lang);
    this.error = page.getByTestId('login-error');
  }
  async goto() {
    await this.open('/login');
  }

  /** Email, password and submit come from the Locator Hub (login.*), so they self-heal. */
  async login(email: string, password: string) {
    await (await this.hub.find('login.email')).fill(email);
    await (await this.hub.find('login.password')).fill(password);
    await (await this.hub.find('login.submit')).click();
  }
}
