/**
 * Upload Playwright results to Testiny with the official CLI (@testiny/cli).
 *
 *   npx tsx utils/testiny/upload-results.ts --suite smoke
 *   npx tsx utils/testiny/upload-results.ts --suite regression --incomplete   (one shard/job of many)
 *   npx tsx utils/testiny/upload-results.ts --suite regression --complete     (after the last job)
 *
 * Env: TESTINY_API_KEY (secret), TESTINY_PROJECT (id, key or name), TEST_ENV, optional TESTINY_SOURCE,
 *      TESTINY_REQUIRED=true to fail the pipeline when the upload fails (default: warn only).
 *
 * How results map in Testiny:
 * - Source     = procurelab-<suite> (one automation source per suite)
 * - Test case  = identified by the "testkey" annotation, e.g. SMK-02-DK (set by the fixtures)
 * - Run        = grouped by run fields: on GitHub ci_repository + ci_run_id (all market jobs of one
 *                pipeline land in ONE run); locally run_id
 * - Fields     = suite, test_env, branch (+ per-result market from the annotation)
 */
import dotenv from 'dotenv';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Local runs: read secrets from e2e/.env (CI provides real environment variables, which take precedence).
dotenv.config({ quiet: true });

const args = process.argv.slice(2);
const opt = (name: string, fallback = '') => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1]!.startsWith('--') ? args[i + 1]! : fallback;
};
const flag = (name: string) => args.includes(`--${name}`);

const suite = opt('suite', process.env.SUITE ?? 'smoke');
const file = path.resolve(opt('file', 'reports/results.json'));
const project = process.env.TESTINY_PROJECT;
const source = process.env.TESTINY_SOURCE ?? `procurelab-${suite}`;
const testEnv = process.env.TEST_ENV ?? 'local';
const onGitHub = process.env.GITHUB_ACTIONS === 'true';
const required = process.env.TESTINY_REQUIRED === 'true';

function finish(code: number, message: string): never {
  console[code === 0 ? 'log' : 'error'](`[testiny] ${message}`);
  process.exit(code);
}

// Without a key the CLI asks interactively and would hang the pipeline, so skip explicitly.
if (!process.env.TESTINY_API_KEY) finish(required ? 1 : 0, 'TESTINY_API_KEY not set - upload skipped.');
if (!project) finish(required ? 1 : 0, 'TESTINY_PROJECT not set - upload skipped.');

const cli = ['testiny-importer', 'automation', '--project', project, '--source', source];

if (flag('complete')) {
  cli.push('--complete-runs');
} else {
  if (!fs.existsSync(file)) finish(required ? 1 : 0, `Result file not found: ${file}`);
  const branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || 'local';
  const fields = [`suite=${suite}`, `test_env=${testEnv}`, `branch=${branch}`];
  if (!onGitHub) fields.push(`run_id=${process.env.RUN_ID ?? new Date().toISOString().slice(0, 16)}`);
  cli.push(
    '--playwright',
    file,
    '--field-values',
    fields.join(','),
    '--custom-result-fields',
    'market',
    '--run-title-pattern',
    onGitHub ? `ProcureLab ${suite} | %{test_env} | %{vc_ref} #%{ci_run_id}` : `ProcureLab ${suite} | %{test_env} | %{run_id}`,
  );
  if (!onGitHub) cli.push('--environment', 'none');
  if (flag('incomplete')) cli.push('--incomplete');
}

console.log(`[testiny] npx ${cli.join(' ')}`);
const res = spawnSync('npx', cli, { stdio: ['ignore', 'inherit', 'inherit'], env: process.env, shell: process.platform === 'win32' });
if (res.status === 0) finish(0, `Uploaded ${suite} results to project "${project}" (source ${source}).`);
finish(
  required ? (res.status ?? 1) : 0,
  `Upload failed with exit code ${res.status}. ${required ? '' : 'Continuing (set TESTINY_REQUIRED=true to fail the build).'}`,
);
