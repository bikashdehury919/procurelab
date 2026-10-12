// Used after sharded / per-market CI jobs: npx playwright merge-reports --config merge.config.ts ./all-blob-reports
export default {
  testDir: 'tests',
  reporter: [
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['json', { outputFile: 'reports/results.json' }],
    ['junit', { outputFile: 'reports/junit.xml' }],
  ],
};
