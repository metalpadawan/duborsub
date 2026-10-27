// Backs up the AniRate database with pg_dump into backups/ (git-ignored), keeping the
// newest few. Works for the local and the production compose setups.
//
//   node database/backup.mjs                        local database (npm run db:backup)
//   node database/backup.mjs --prod                 production (docker-compose.prod.yml)
//   node database/backup.mjs --keep 30
//
// Restore one with:
//   docker compose exec -T postgres pg_restore -U anirate -d anime_platform --clean --if-exists < backups/<file>.dump
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const prod = argv.includes('--prod');
const keepIndex = argv.indexOf('--keep');
const keep = keepIndex >= 0 ? Math.max(1, Number(argv[keepIndex + 1]) || 14) : 14;
const backupDir = resolve(root, 'backups');

const compose = prod ? ['compose', '-f', 'docker-compose.prod.yml', '--env-file', '.env.production'] : ['compose'];
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const file = resolve(backupDir, `anime_platform-${prod ? 'prod' : 'local'}-${stamp}.dump`);

mkdirSync(backupDir, { recursive: true });
// Custom format (-Fc): compressed, and restorable table by table.
const dump = execFileSync('docker', [...compose, 'exec', '-T', 'postgres', 'pg_dump', '-U', 'anirate', '-Fc', 'anime_platform'], {
  cwd: root,
  maxBuffer: 1024 * 1024 * 1024,
});
writeFileSync(file, dump);
console.log(`Backed up ${(dump.length / 1024 / 1024).toFixed(1)} MB to ${file}`);

const prefix = `anime_platform-${prod ? 'prod' : 'local'}-`;
const old = readdirSync(backupDir)
  .filter((name) => name.startsWith(prefix) && name.endsWith('.dump'))
  .sort((left, right) => statSync(resolve(backupDir, right)).mtimeMs - statSync(resolve(backupDir, left)).mtimeMs)
  .slice(keep);
for (const name of old) unlinkSync(resolve(backupDir, name));
if (old.length) console.log(`Removed ${old.length} older backup(s), keeping the newest ${keep}.`);
