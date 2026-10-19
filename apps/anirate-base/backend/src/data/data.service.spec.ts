import { afterEach, describe, expect, it } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DataService } from './data.service';

const tempDirs: string[] = [];

function createConfig(values: Record<string, unknown>) {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

function createTempDataFile() {
  const dir = mkdtempSync(join(tmpdir(), 'anirate-data-'));
  tempDirs.push(dir);
  return join(dir, 'anirate-db.json');
}

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe('DataService', () => {
  it('seeds demo accounts in development', () => {
    const service = new DataService(createConfig({ NODE_ENV: 'development', DATA_FILE: createTempDataFile() }));

    expect(service.users.map((user) => user.email)).toContain('admin@example.com');
    expect(service.anime.length).toBeGreaterThan(0);
  });

  it('never seeds the demo accounts in production', () => {
    const service = new DataService(createConfig({ NODE_ENV: 'production', DATA_FILE: createTempDataFile() }));

    expect(service.users).toHaveLength(0);
    expect(service.genres.length).toBeGreaterThan(0);
  });

  it('creates only the configured admin in production', () => {
    const service = new DataService(
      createConfig({
        NODE_ENV: 'production',
        DATA_FILE: createTempDataFile(),
        SEED_ADMIN_EMAIL: 'Owner@Example.com',
        SEED_ADMIN_PASSWORD: 'a-long-random-password',
      }),
    );

    expect(service.users).toHaveLength(1);
    expect(service.users[0]).toMatchObject({ email: 'owner@example.com', role: 'admin' });
  });

  it('prunes expired sessions and spent reset tokens when it writes', async () => {
    const dataFile = createTempDataFile();
    const service = new DataService(createConfig({ NODE_ENV: 'development', DATA_FILE: dataFile }));
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);

    service.refreshTokens.push(
      { id: 'expired', userId: 'u', tokenHash: 'a', ipAddress: null, userAgent: null, expiresAt: past, revokedAt: null, replacedByTokenId: null, createdAt: past },
      { id: 'revoked-live', userId: 'u', tokenHash: 'b', ipAddress: null, userAgent: null, expiresAt: future, revokedAt: past, replacedByTokenId: null, createdAt: past },
    );
    service.passwordResetTokens.push(
      { id: 'used', userId: 'u', tokenHash: 'c', expiresAt: future, usedAt: past, createdAt: past },
      { id: 'pending', userId: 'u', tokenHash: 'd', expiresAt: future, usedAt: null, createdAt: past },
    );

    service.save();
    await service.flush();

    const persisted = JSON.parse(readFileSync(dataFile, 'utf8'));
    expect(persisted.refreshTokens.map((token: { id: string }) => token.id)).toEqual(['revoked-live']);
    expect(persisted.passwordResetTokens.map((token: { id: string }) => token.id)).toEqual(['pending']);
  });

  it('coalesces a burst of saves into a write that includes every change', async () => {
    const dataFile = createTempDataFile();
    const service = new DataService(createConfig({ NODE_ENV: 'development', DATA_FILE: dataFile }));

    service.genres.push({ id: 100, name: 'One' });
    service.save();
    service.genres.push({ id: 101, name: 'Two' });
    service.save();
    await service.flush();

    const persisted = JSON.parse(readFileSync(dataFile, 'utf8'));
    expect(persisted.genres.map((genre: { id: number }) => genre.id)).toEqual(expect.arrayContaining([100, 101]));
  });

  it('loads refresh tokens written before replacedByTokenId existed', () => {
    const dataFile = createTempDataFile();
    writeFileSync(
      dataFile,
      JSON.stringify({
        users: [],
        refreshTokens: [
          { id: 'legacy', userId: 'u', tokenHash: 'x', ipAddress: null, userAgent: null, expiresAt: new Date(Date.now() + 60_000).toISOString(), revokedAt: null, createdAt: new Date().toISOString() },
        ],
      }),
    );

    const service = new DataService(createConfig({ NODE_ENV: 'development', DATA_FILE: dataFile }));

    expect(service.refreshTokens[0].replacedByTokenId).toBeNull();
  });
});
