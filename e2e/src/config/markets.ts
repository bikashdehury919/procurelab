import path from 'node:path';
import { env, loadTestData } from './env';

export const MARKETS = ['NL', 'BE', 'DK', 'DE'] as const;
export type MarketCode = (typeof MARKETS)[number];
export type Lang = 'en' | 'nl' | 'da' | 'de';
export type Role = 'admin' | 'buyer' | `vendor-${MarketCode}`;

export interface MarketTestData {
  accounts: { admin: string; buyer: string; locked: string; vendor: Record<MarketCode, string> };
  seeded: Record<MarketCode, { project: string; rfpWithProposals: string; vendorCompany: string; vendorOpenRfp: string; securityVendor: string }>;
}

/** Environment-specific data: test-data/<TEST_ENV>/markets.json */
export const testData = loadTestData<MarketTestData>('markets.json');

export function emailFor(role: Role): string {
  if (role === 'admin') return testData.accounts.admin;
  if (role === 'buyer') return testData.accounts.buyer;
  const market = role.slice('vendor-'.length) as MarketCode;
  return testData.accounts.vendor[market];
}

export const authFile = (role: Role) => path.join(env.authDir, `${role}.json`);

/** Shape of GET /api/config: the app is the source of truth for VAT, currency and flags. */
export interface AppConfig {
  version: string;
  markets: Array<{
    code: MarketCode;
    defaultLang: Lang;
    currency: string;
    vatRate: number;
    flags: Record<'vatBreakdown' | 'aiAnalyzer' | 'vendorQuestions' | 'deadlineExtension', boolean>;
  }>;
  scoringWeights: { price: number; delivery: number; rating: number };
  expertise: string[];
}
export type MarketConfig = AppConfig['markets'][number];

/** Format money exactly like the app does (language + market region, market currency). */
export function money(amount: number, lang: string, market: MarketCode, currency: string): string {
  return new Intl.NumberFormat(`${lang}-${market}`, { style: 'currency', currency }).format(amount);
}

/** Format an ISO date (YYYY-MM-DD) exactly like the app's fmt.date (e.g. "10 Nov 2026"). */
export function shortDate(iso: string, lang: string, market: MarketCode): string {
  return new Intl.DateTimeFormat(`${lang}-${market}`, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${iso}T12:00:00Z`));
}
