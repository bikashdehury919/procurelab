// Recreate the demo data from the command line: npm run reset-data
const { seed } = require('../src/seed');
const { DATA_DIR } = require('../src/config');
seed();
console.log(`Demo data restored in ${DATA_DIR}`);
