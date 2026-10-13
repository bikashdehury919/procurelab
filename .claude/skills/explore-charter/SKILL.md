---
name: explore-charter
description: Run a time-boxed exploratory testing session from a Testiny charter (EXP-xx) with Playwright CLI, then log the session notes and result in Testiny. Use when asked to run, execute or explore a charter.
---

# Explore a charter

The human tester owns the charter and decides what is a real problem. You do the legwork and report facts with evidence.

1. **Read the charter** from Testiny project PL via the Testiny MCP: mission, setup, areas, time-box.
2. **Plan 3 to 5 short tours** that fit the time-box. State them in one line each before you start.
3. **Explore** with playwright-cli on http://localhost:3000. Sign in as the role the charter names (demo
   password Demo123!). Switch market and language with `?market=` and `?lang=`. For every finding take a
   screenshot and save it under `e2e/reports/exploratory/<charter id>/`.
4. **Stop at the time-box** and write session notes in charter format:
   - Charter, tester ("Claude, for <person>"), duration, environment (local; markets and languages covered)
   - Covered and not covered
   - Findings: title, severity, steps, expected vs actual, market + language, evidence file
   - Questions, and ideas for new test cases
5. **Log it in Testiny** via MCP: create a test run named "<charter id> session <date>", add the charter case,
   set the result (failed if you found bugs, passed if not) and add the session notes as the result comment.
   If an MCP call fails or is not available, say exactly which step failed and print the notes so they can be pasted.
6. **Do not change application code or tests.** For each bug, suggest one regression test (title + expected result).