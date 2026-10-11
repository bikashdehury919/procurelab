import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import type { Lang, MarketCode } from '../config/markets';

export class AdminUsersPage extends BasePage {
  readonly rows: Locator;
  readonly error: Locator;

  constructor(page: Page, market: MarketCode, lang?: Lang) {
    super(page, market, lang);
    this.rows = page.getByTestId('user-row');
    this.error = page.getByTestId('users-error');
  }

  async goto() {
    await this.open('/admin/users');
  }

  row(email: string): Locator {
    return this.page.locator(`[data-testid="user-row"][data-email="${email}"]`);
  }

  async createUser(u: { name: string; email: string; role: 'admin' | 'buyer' | 'vendor'; market?: MarketCode; vendorLabel?: string; password: string }) {
    await this.page.getByTestId('input-name').fill(u.name);
    await this.page.getByTestId('input-email').fill(u.email);
    await this.page.getByTestId('input-role').selectOption(u.role);
    if (u.market) await this.page.getByTestId('input-market').selectOption(u.market);
    if (u.vendorLabel) await this.page.getByTestId('input-vendorId').selectOption({ label: u.vendorLabel });
    await this.page.getByTestId('input-password').fill(u.password);
    await this.page.getByTestId('create-user').click();
  }

  async deactivate(email: string) {
    await this.row(email).getByTestId('deactivate-user').click();
  }
}
