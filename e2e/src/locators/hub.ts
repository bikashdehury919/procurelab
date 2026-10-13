import type { Page } from '@playwright/test';

/** How to find an element. The first strategy of an entry is the primary; the rest are fallbacks. */
export type Strategy =
  | { by: 'testid'; value: string }
  | { by: 'css'; value: string }
  | { by: 'role'; role: Parameters<Page['getByRole']>[0]; name?: string | RegExp }
  | { by: 'label'; value: string | RegExp };

export interface HubEntry {
  /** What the element is, in words: used by people and by the heal-locators skill to confirm a heal. */
  description: string;
  strategies: [Strategy, ...Strategy[]];
}

/**
 * Locator Hub: one registry for the locators the suite depends on most.
 * - Primary = the stable data-testid. Fallbacks = other ways to find the SAME element.
 * - At runtime, LocatorHub.find() heals deterministically (no AI) and logs every heal.
 * - Claude Code's heal-locators skill turns logged heals into a reviewed change of this file.
 */
export const LOCATORS = {
  'portal.vendorCompany': {
    description: 'Vendor portal: the signed-in vendor company name, directly under the page title',
    strategies: [
      { by: 'testid', value: 'vendor-company' },
      { by: 'css', value: '[data-testid*="vendor-company"]' },
      { by: 'css', value: 'h1 + p.meta' },
    ],
  },
  'portal.submitProposal': {
    description: 'Vendor portal: the submit button of the proposal form',
    strategies: [
      { by: 'testid', value: 'submit-proposal' },
      { by: 'css', value: '[data-testid="proposal-form"] button[type="submit"]' },
    ],
  },
} satisfies Record<string, HubEntry>;

export type LocatorKey = keyof typeof LOCATORS;
