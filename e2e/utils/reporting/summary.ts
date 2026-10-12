/**
 * Writes reports/summary.md + reports/summary.json from the Playwright JSON report and,
 * on GitHub Actions, appends the markdown to the job summary page.
 *   npx tsx utils/reporting/summary.ts [--suite smoke] [--report-url https://...]
 */
import fs from 'node:fs';
import { readSummary } from './results';

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const suite = arg('suite') ?? process.env.SUITE ?? 'tests';
const reportUrl = arg('report-url') ?? process.env.REPORT_URL ?? '';

const s = readSummary();
const icon = s.totals.failed ? 'FAILED' : s.totals.flaky ? 'PASSED (with flaky tests)' : 'PASSED';
const lines = [
  `## ProcureLab ${suite}: ${icon}`,
  '',
  `**${s.totals.passed + s.totals.flaky}/${s.totals.passed + s.totals.failed + s.totals.flaky} passed** (${s.totals.passRate}%), ${s.totals.failed} failed, ${s.totals.flaky} flaky, ${s.totals.skipped} skipped, ${(s.durationMs / 1000).toFixed(0)} s`,
  reportUrl ? `\n[Open the HTML report](${reportUrl})` : '',
  '',
  '| Project | Passed | Failed | Flaky | Skipped |',
  '|---|---|---|---|---|',
  ...Object.entries(s.byProject).map(([p, c]) => `| ${p} | ${c.passed} | ${c.failed} | ${c.flaky} | ${c.skipped} |`),
];
if (s.failed.length) lines.push('', '### Failed', '', ...s.failed.map((f) => `- **${f.id || f.title}** (${f.project}): ${f.error}`));
if (s.flaky.length) lines.push('', '### Flaky (passed on retry)', '', ...s.flaky.map((f) => `- ${f.id || f.title} (${f.project})`));

const md = lines.join('\n') + '\n';
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/summary.md', md);
fs.writeFileSync('reports/summary.json', JSON.stringify({ suite, reportUrl, ...s }, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
console.log(md);
