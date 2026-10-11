import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import type { Lang, MarketCode } from '../config/markets';
export class LoginPage extends BasePage {
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly error: Locator;
  constructor(page: Page, market: MarketCode, lang?: Lang) {
    super(page, market, lang);
    this.email = page.getByTestId('input-email');
    this.password = page.getByTestId('input-password');
    this.submit = page.getByTestId('sign-in');
    this.error = page.getByTestId('login-error');
  }
  async goto() {
    await this.open('/login');
  }

  async login(email: string, password: string) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}
