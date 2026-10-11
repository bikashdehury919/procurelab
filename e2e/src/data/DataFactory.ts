import { fakerNL, fakerNL_BE, fakerDA, fakerDE, type Faker } from '@faker-js/faker';
import { env } from '../config/env';
import type { MarketCode } from '../config/markets';

const FAKERS: Record<MarketCode, Faker> = { NL: fakerNL, BE: fakerNL_BE, DK: fakerDA, DE: fakerDE };
const EXPERTISE = ['cloud', 'data', 'security', 'devops', 'support', 'network'] as const;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const daysFromNow = (n: number) => isoDate(new Date(Date.now() + n * 86_400_000));

/**
 * Builds realistic, locale-specific test data (Dutch, Flemish, Danish, German names and cities).
 * - Every name carries a run tag ("PW-<runId>-<n>") so data is unique across parallel workers
 *   and easy to trace back to the pipeline run that created it.
 * - Set FAKER_SEED to reproduce exactly the same data when debugging a failure.
 */
export class DataFactory {
  readonly faker: Faker;
  private counter = 0;

  constructor(
    readonly market: MarketCode,
    private readonly workerIndex = 0,
  ) {
    this.faker = FAKERS[market];
    if (env.fakerSeed !== undefined) this.faker.seed(env.fakerSeed + workerIndex);
  }

  /** Unique, traceable suffix: PW-<runId>-w<worker>-<n> */
  tag(): string {
    this.counter += 1;
    return `PW-${env.runId}-w${this.workerIndex}-${this.counter}`;
  }

  project(
    overrides: Partial<{
      name: string;
      owner: string;
      budget: number;
      startDate: string;
      endDate: string;
      status: 'planning' | 'active' | 'completed';
      description: string;
    }> = {},
  ) {
    const start = this.faker.number.int({ min: 1, max: 60 });
    return {
      market: this.market,
      name: `${this.faker.company.buzzNoun()} ${this.faker.word.noun()} ${this.tag()}`.replace(/^\w/, (c) => c.toUpperCase()),
      owner: this.faker.person.fullName(),
      budget: this.faker.number.int({ min: 50, max: 900 }) * 1000,
      startDate: daysFromNow(start),
      endDate: daysFromNow(start + this.faker.number.int({ min: 90, max: 400 })),
      status: 'active' as const,
      description: this.faker.lorem.sentence(),
      ...overrides,
    };
  }

  requirement(priority: 'must' | 'should' | 'could' = 'must') {
    return { name: `${this.faker.hacker.verb()} ${this.faker.hacker.noun()}`.replace(/^\w/, (c) => c.toUpperCase()), priority };
  }

  vendor(overrides: Partial<{ name: string; rating: number; expertise: string[] }> = {}) {
    const first = this.faker.person.firstName();
    return {
      market: this.market,
      name: `${this.faker.company.name()} ${this.tag()}`,
      city: this.faker.location.city(),
      expertise: this.faker.helpers.arrayElements([...EXPERTISE], { min: 1, max: 3 }),
      rating: this.faker.number.float({ min: 3, max: 5, fractionDigits: 1 }),
      certifications: this.faker.helpers.arrayElements(['ISO 27001', 'ISO 9001', 'SOC 2', 'ITIL'], { min: 1, max: 2 }),
      contact: `${first} ${this.faker.person.lastName()}`,
      contactEmail: `${first.toLowerCase().replace(/[^a-z]/g, '')}.${this.tag().toLowerCase()}@example.test`,
      ...overrides,
    };
  }

  user(role: 'admin' | 'buyer' | 'vendor', overrides: Partial<{ vendorId: string; password: string }> = {}) {
    const tag = this.tag().toLowerCase();
    return {
      name: this.faker.person.fullName(),
      email: `${role}.${tag}@procurelab.test`,
      role,
      market: this.market,
      password: `Pw!${this.faker.string.alphanumeric(10)}`,
      ...overrides,
    };
  }

  proposal() {
    return {
      priceNet: this.faker.number.int({ min: 20, max: 400 }) * 1000,
      deliveryMonths: this.faker.number.int({ min: 1, max: 12 }),
      note: this.faker.lorem.sentence(),
    };
  }

  futureDate(days = 30) {
    return daysFromNow(days);
  }
  pastDate(days = 3) {
    return daysFromNow(-days);
  }
}
