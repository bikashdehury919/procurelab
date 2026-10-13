/**
 * Summarises runtime heals from reports/healing.jsonl into reports/healing.md (and the GitHub job summary).
 *   npm run healing:report        exit code 0 always; heals are warnings, not failures
 */
import fs from 'node:fs';
import { HEALING_LOG, type HealEvent } from '../../src/locators/LocatorHub';

const events: HealEvent[] = fs.existsSync(HEALING_LOG)
  ? fs
      .readFileSync(HEALING_LOG, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as HealEvent)
  : [];

const byKey = new Map<string, { event: HealEvent; count: number; tests: Set<string> }>();
for (const e of events) {
  const k = `${e.key}|${e.healedWith}|${e.found.testid ?? ''}`;
  const row = byKey.get(k) ?? { event: e, count: 0, tests: new Set<string>() };
  row.count += 1;
  row.tests.add(e.test);
  byKey.set(k, row);
}

const lines = events.length
  ? [
      `## Healed locators: ${byKey.size} (${events.length} heals)`,
      '',
      '| Hub key | Broken primary | Healed with | Element now | Tests |',
      '|---|---|---|---|---|',
      ...[...byKey.values()].map(
        ({ event: e, count, tests }) =>
          `| ${e.key} | ${e.broken} | ${e.healedWith} | ${e.found.testid ? `data-testid="${e.found.testid}"` : `<${e.found.tag}>`} "${e.found.text}" | ${tests.size} test(s), ${count} heal(s) |`,
      ),
      '',
      'Next step: run the heal-locators skill in Claude Code to make these fixes permanent in src/locators/hub.ts.',
    ]
  : ['## Healed locators: none', '', 'Every primary locator worked.'];

const md = lines.join('\n') + '\n';
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/healing.md', md);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
console.log(md);
