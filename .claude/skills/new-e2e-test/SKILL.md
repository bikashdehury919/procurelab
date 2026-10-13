---
name: new-e2e-test
description: Turn a Testiny test case (or a written scenario) into a Playwright test in e2e/, using the page objects, fixtures and data factory. Use when asked to automate a scenario, a Testiny case, or a ticket's acceptance criteria.
---

# New E2E test workflow

1. **Read the scenario.** If a Testiny key or title is given, fetch it with the Testiny MCP tools
   (listTestCases); otherwise use the scenario text. Note the id (e.g. VEN-02), markets and role.
2. **Explore the live page** with Playwright CLI instead of guessing selectors:
   `playwright-cli open http://localhost:3000/login`, sign in, `playwright-cli snapshot`.
   Confirm every element you need has a data-testid. If one is missing, stop and report it (app change needed).
3. **Reuse before you add.** Check e2e/src/pages/ for an existing page object and method. Add a method only if
   the page object lacks it; keep locators in the page object, never in the spec.
4. **Write the spec** in e2e/tests/smoke or e2e/tests/regression following CLAUDE.md: id annotation, tag,
   seed via API, act via page objects, web-first expects, expected values from appConfig.
5. **Run it** from e2e/: `npx playwright test -g "<ID>" --project=regression --repeat-each=3`, then `npm run typecheck`.
   On failure, open the trace (npx playwright show-trace test-results/<folder>/trace.zip) before changing code.
6. **Report**: what you added, the test id, run results, and any app defects found. Do not commit secrets.