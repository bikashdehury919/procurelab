---
name: heal-locators
description: Turn runtime healing events from the Locator Hub (e2e/reports/healing.jsonl) into a permanent, reviewed fix in e2e/src/locators/hub.ts. Use when tests report "healed" locators, or when a locator broke after a UI change.
---

# Heal locators

The Locator Hub heals at runtime without AI: if a primary locator finds nothing, it tries the fallbacks and logs
every heal. Your job is to make a heal permanent, safely, so the suite does not depend on fallbacks.

1. **Collect the heals.** From `e2e/`, run `npm run healing:report` and read `reports/healing.md` and
   `reports/healing.jsonl`. If there are none but a test fails on a hub locator, run that test once with
   the default `HEALING=on` to collect the event.
2. **Confirm each heal on the real page.** For every event, open its `url` with playwright-cli (sign in with the
   role the test uses; the demo password is Demo123!), take a snapshot, and check that the element the fallback
   found matches the entry's `description` in `src/locators/hub.ts` (same element, same role, same text).
3. **Decide.**
   - The app renamed or moved the element on purpose: change the PRIMARY strategy of that hub entry to the
     element's new `data-testid`. Keep the fallbacks.
   - The element is gone, or the fallback found a different element: do NOT heal. Report it as a possible app bug.
4. **Stay in scope.** Only edit `src/locators/hub.ts` (or add a missing hub key). Never change assertions,
   expected values, test steps or application code.
5. **Prove it.** From `e2e/`: delete `reports/healing.jsonl`, run the affected tests with `HEALING=off` and
   `--repeat-each=3` (strict: the primary must work without fallbacks), then `npm run typecheck` and `npm run lint`.
6. **Report.** A table: hub key | old primary | new primary | evidence (url, element, text). Propose the commit
   message `fix(e2e): heal <key> after <app change>`. Do not commit or push unless asked.