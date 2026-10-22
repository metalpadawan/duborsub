// Brings the test database to the current schema once per test run.
const { execSync } = require('node:child_process');
const { resolve } = require('node:path');
const { testDatabaseUrl } = require('./database-url');

module.exports = async () => {
  execSync('npx prisma migrate reset --force --skip-seed --skip-generate', {
    cwd: resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: 'pipe',
  });
};
