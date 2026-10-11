# ProcureLab - app + E2E test platform (rules for Claude Code)

## Repository layout
- App (Node/Express, port 3000): server.js, src/ (routes, views, store), public/, data/ (JSON files + uploads, git-ignored)
- E2E platform (Playwright + TypeScript): e2e/  -> run all test commands from e2e/
- CI: .github/workflows/e2e.yml (PR gate: api -> smoke x4 markets -> e2e-gate), e2e-nightly.yml (regression, 4 shards)
- Product: vendor management / RFPs. Markets NL BE DK DE, languages en nl da de, roles admin, buyer, vendor.

## Commands
App (repo root):   npm start | npm run reset-data
Tests (cd e2e):    npm run typecheck | npx playwright test --project=api | npx playwright test --project=smoke-DK
                   npm run test:smoke | npm run test:regression | npx playwright test -g "REG-RFP" --repeat-each=3
Explore the UI:    playwright-cli open http://localhost:3000/login ; playwright-cli snapshot

## Rules for app changes (developers and agents)
1. Every new interactive or asserted element gets a data-testid (kebab-case).
2. New features ship behind a feature flag (src/flags.js) that is off by default.
3. The pull request that breaks an E2E test fixes it in the same pull request (usually the page object).
4. Never change e2e/tests/smoke without saying so in the PR description: smoke is the release gate.

## E2E architecture (do not bypass)
- e2e/src/config/env.ts       env profiles e2e/config/env/.env.<TEST_ENV>; secrets only from e2e/.env or CI secrets
- e2e/test-data/<env>/        environment-specific expected data (seeded names, accounts)
- e2e/src/data/DataFactory.ts ALL generated data (Faker per market locale). Never hard-code names in specs.
- e2e/src/api/TestDataApi.ts  arrange/cleanup through the API, never through the UI
- e2e/src/pages/*             Page Object Model: one class per page, locators via getByTestId only
- e2e/src/fixtures/test.ts    import test/expect from here, never from @playwright/test in specs
- e2e/utils/                  Testiny upload, email, reporting, LLM judge

## Rules for new tests
1. Every test has an id annotation: { annotation: { type: 'id', description: 'REG-XXX-NN' } } -> becomes the Testiny key (+ market).
2. Tag @smoke (e2e/tests/smoke, read-mostly, < 10 s each) or @regression (e2e/tests/regression).
3. Arrange through seed.* (API), act through page objects, assert with web-first expect(locator).
4. Selectors: getByTestId first, then getByRole/getByLabel. No CSS chains, no XPath, no nth() on dynamic lists.
5. No waitForTimeout, no page.waitForSelector - use auto-waiting expects.
6. Expected VAT, currency and flags come from appConfig (GET /api/config); money via money().
7. Tests are independent and parallel-safe: unique data per test, cleanup registered in the fixture.
   Data created through the UI must be deleted through the API in a finally block.
8. Never weaken an assertion to make a test pass. If the app is wrong, use test.fail() with an issue annotation and report it.
9. A new test must pass with --repeat-each=3 and npm run typecheck before it is proposed.