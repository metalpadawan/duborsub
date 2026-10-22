// The integration tests' database: DATABASE_URL_TEST from the environment or
// backend/.env. Tests truncate every table, so a database whose name does not say
// "test" is refused outright.
const { existsSync } = require('node:fs');
const { resolve } = require('node:path');

function testDatabaseUrl() {
  const envFile = resolve(__dirname, '..', '.env');
  if (!process.env.DATABASE_URL_TEST && existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }

  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error('Set DATABASE_URL_TEST to a PostgreSQL database the tests may wipe (see .env.example).');
  }

  const name = new URL(url).pathname.replace(/^\//, '');
  if (!/test/i.test(name)) {
    throw new Error(`DATABASE_URL_TEST points at "${name}"; the tests wipe it, so its name must contain "test".`);
  }

  return url;
}

module.exports = { testDatabaseUrl };
