// Starts the local PostgreSQL (docker-compose.yml) with a password that never enters
// git. On first run it generates a random password into the repo-root .env, points
// the backend's .env at it, and from then on keeps the running database's password
// in step with that file, so rotating it is: delete POSTGRES_PASSWORD from .env, rerun.
//
//   node database/setup-local.mjs        (run by `npm run db:up`)
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rootEnv = resolve(root, '.env');
const backendEnv = resolve(root, 'apps/anirate-base/backend/.env');
const backendEnvExample = resolve(root, 'apps/anirate-base/backend/.env.example');
const DB_USER = 'anirate';

function readEnv(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function setVar(text, key, value) {
  const line = `${key}="${value}"`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  return pattern.test(text) ? text.replace(pattern, line) : `${text.replace(/\n*$/, '\n')}${line}\n`;
}

// 1. The password lives only in the git-ignored repo-root .env, which Docker Compose reads.
let rootText = readEnv(rootEnv);
let password = /^POSTGRES_PASSWORD="?([^"\r\n]+)"?$/m.exec(rootText)?.[1];
if (!password) {
  password = randomBytes(24).toString('hex');
  rootText = setVar(rootText || '# Local-only settings for docker-compose.yml. Never commit this file.\n', 'POSTGRES_PASSWORD', password);
  writeFileSync(rootEnv, rootText);
  console.log('Generated a new local database password in .env');
}

// 2. The backend connects with the same password.
if (!existsSync(backendEnv)) {
  copyFileSync(backendEnvExample, backendEnv);
  console.log('Created apps/anirate-base/backend/.env from .env.example; set JWT_SECRET in it before starting the backend.');
}
let backendText = readEnv(backendEnv);
backendText = setVar(backendText, 'DATABASE_URL', `postgresql://${DB_USER}:${password}@localhost:5432/anime_platform?schema=public`);
backendText = setVar(backendText, 'DATABASE_URL_TEST', `postgresql://${DB_USER}:${password}@localhost:5432/anime_platform_test?schema=public`);
writeFileSync(backendEnv, backendText);

// 3. Start the database, then set the password on it. POSTGRES_PASSWORD only applies
// when the data volume is first created, so an existing database is updated here.
execFileSync('docker', ['compose', 'up', '-d', '--wait'], { cwd: root, stdio: 'inherit' });
execFileSync(
  'docker',
  ['exec', 'anirate-postgres', 'psql', '-q', '-U', DB_USER, '-d', 'anime_platform', '-c', `ALTER USER ${DB_USER} WITH PASSWORD '${password}'`],
  { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] },
);
console.log('Local PostgreSQL is running on 127.0.0.1:5432.');
