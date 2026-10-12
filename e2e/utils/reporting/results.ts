import fs from 'node:fs';

/** Minimal typing of Playwright's JSON reporter output (only what we read). */
interface JsonResult {
  status: string;
  duration: number;
  retry: number;
  error?: { message?: string };
}
interface JsonTest {
  projectName: string;
  status: 'expected' | 'unexpected' | 'flaky' | 'skipped';
  annotations: Array<{ type: string; description?: string }>;
  results: JsonResult[];
}
interface JsonSpec {
  title: string;
  file: string;
  tags: string[];
  tests: JsonTest[];
}
interface JsonSuite {
  title: string;
  specs?: JsonSpec[];
  suites?: JsonSuite[];
}
interface JsonReport {
  stats: { startTime: string; duration: number; expected: number; unexpected: number; flaky: number; skipped: number };
  suites: JsonSuite[];
}

export interface TestRow {
  id: string;
  title: string;
  file: string;
  project: string;
  market: string;
  status: JsonTest['status'];
  durationMs: number;
  error: string;
}
export interface Summary {
  startTime: string;
  durationMs: number;
  totals: { passed: number; failed: number; flaky: number; skipped: number; total: number; passRate: number };
  byProject: Record<string, { passed: number; failed: number; flaky: number; skipped: number }>;
  failed: TestRow[];
  flaky: TestRow[];
  slowest: TestRow[];
}

const walk = (s: JsonSuite): JsonSpec[] => [...(s.specs ?? []), ...(s.suites ?? []).flatMap(walk)];

export function readSummary(file = 'reports/results.json'): Summary {
  const report = JSON.parse(fs.readFileSync(file, 'utf8')) as JsonReport;
  const rows: TestRow[] = report.suites
    .flatMap(walk)
    .flatMap((spec) =>
      spec.tests.map((t) => {
        const last = t.results[t.results.length - 1];
        return {
          id: t.annotations.find((a) => a.type === 'testkey')?.description ?? t.annotations.find((a) => a.type === 'id')?.description ?? '',
          title: spec.title,
          file: spec.file,
          project: t.projectName,
          market: t.annotations.find((a) => a.type === 'market')?.description ?? '',
          status: t.status,
          durationMs: t.results.reduce((sum, r) => sum + r.duration, 0),
          error: (last?.error?.message ?? '').replace(/\u001b\[[0-9;]*m/g, '').split('\n')[0] ?? '',
        };
      }),
    )
    .filter((r) => r.project !== 'setup');

  const byProject: Summary['byProject'] = {};
  for (const r of rows) {
    const p = (byProject[r.project] ??= { passed: 0, failed: 0, flaky: 0, skipped: 0 });
    if (r.status === 'expected') p.passed++;
    else if (r.status === 'unexpected') p.failed++;
    else if (r.status === 'flaky') p.flaky++;
    else p.skipped++;
  }
  const count = (s: TestRow['status']) => rows.filter((r) => r.status === s).length;
  const passed = count('expected'),
    failed = count('unexpected'),
    flaky = count('flaky'),
    skipped = count('skipped');
  const executed = passed + failed + flaky;
  return {
    startTime: report.stats.startTime,
    durationMs: report.stats.duration,
    totals: { passed, failed, flaky, skipped, total: rows.length, passRate: executed ? Math.round(((passed + flaky) / executed) * 1000) / 10 : 0 },
    byProject,
    failed: rows.filter((r) => r.status === 'unexpected'),
    flaky: rows.filter((r) => r.status === 'flaky'),
    slowest: [...rows].sort((a, b) => b.durationMs - a.durationMs).slice(0, 5),
  };
}
