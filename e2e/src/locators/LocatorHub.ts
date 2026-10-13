import fs from 'node:fs';
import path from 'node:path';
import { test, type Locator, type Page } from '@playwright/test';
import { LOCATORS, type HubEntry, type LocatorKey, type Strategy } from './hub';

/** HEALING=on (default): use fallbacks and log the heal. HEALING=off: strict, the primary must work. */
const HEALING = (process.env.HEALING ?? 'on').toLowerCase() !== 'off';
export const HEALING_LOG = path.resolve(__dirname, '../../reports/healing.jsonl');

export interface HealEvent {
  key: LocatorKey;
  description: string;
  test: string;
  url: string;
  broken: string;
  healedWith: string;
  found: { testid: string | null; tag: string; text: string };
  at: string;
}

export const describeStrategy = (s: Strategy): string =>
  s.by === 'role' ? `role=${s.role}${s.name ? ` name=${String(s.name)}` : ''}` : `${s.by}=${String(s.value)}`;

export class LocatorHub {
  constructor(private readonly page: Page) {}

  /**
   * Returns a locator for a hub key. Tries the primary strategy first; if it finds nothing, tries each
   * fallback and accepts it only when it matches exactly ONE element. A heal is logged as a test annotation,
   * an attachment and a line in reports/healing.jsonl. If nothing matches, the primary is returned so the
   * test fails with the normal Playwright error.
   */
  async find(key: LocatorKey, { timeout = 5_000 }: { timeout?: number } = {}): Promise<Locator> {
    const entry: HubEntry = LOCATORS[key];
    const [primary, ...fallbacks] = entry.strategies;
    const first = this.toLocator(primary);
    if (await this.appears(first, timeout)) return first;
    if (!HEALING) return first;
    for (const candidate of fallbacks) {
      const locator = this.toLocator(candidate);
      if ((await this.appears(locator, 1_000)) && (await locator.count()) === 1) {
        await this.record(key, entry, primary, candidate, locator);
        return locator;
      }
    }
    return first;
  }

  private toLocator(s: Strategy): Locator {
    switch (s.by) {
      case 'testid':
        return this.page.getByTestId(s.value);
      case 'css':
        return this.page.locator(s.value);
      case 'role':
        return this.page.getByRole(s.role, s.name ? { name: s.name } : undefined);
      case 'label':
        return this.page.getByLabel(s.value);
    }
  }

  private async appears(locator: Locator, timeout: number): Promise<boolean> {
    try {
      await locator.first().waitFor({ state: 'attached', timeout });
      return true;
    } catch {
      return false;
    }
  }

  private async record(key: LocatorKey, entry: HubEntry, primary: Strategy, used: Strategy, locator: Locator) {
    const found = await locator.evaluate((el) => ({
      testid: el.getAttribute('data-testid'),
      tag: el.tagName.toLowerCase(),
      text: (el.textContent ?? '').trim().slice(0, 80),
    }));
    let title = 'outside a test';
    let info: ReturnType<typeof test.info> | undefined;
    try {
      info = test.info();
      title = info.titlePath.slice(1).join(' > ');
    } catch {
      info = undefined;
    }
    const event: HealEvent = {
      key,
      description: entry.description,
      test: title,
      url: this.page.url(),
      broken: describeStrategy(primary),
      healedWith: describeStrategy(used),
      found,
      at: new Date().toISOString(),
    };
    const line = `${key}: ${event.broken} not found; healed with ${event.healedWith}${found.testid ? ` (element now has data-testid="${found.testid}")` : ''}`;
    if (info) {
      info.annotations.push({ type: 'healed', description: line });
      await info.attach(`healing-${key}`, { body: JSON.stringify(event, null, 2), contentType: 'application/json' });
    }
    fs.mkdirSync(path.dirname(HEALING_LOG), { recursive: true });
    fs.appendFileSync(HEALING_LOG, JSON.stringify(event) + '\n');
    console.warn(`[healing] ${line}`);
  }
}
