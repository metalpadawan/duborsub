// test/anime.e2e-spec.ts
// End-to-end tests for anime + ratings endpoints.
// Requires a running test database (see jest-e2e.json).

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Anime + Ratings (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
  let adminToken: string;
  let testAnimeId: string;
  let testUserId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    // Seed: create a regular user and an admin user
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash('TestPass1!', 4);

    const user = await prisma.user.create({
      data: { username: 'e2e_user', email: 'e2e_user@test.com', passwordHash: hash },
    });
    const admin = await prisma.user.create({
      data: { username: 'e2e_admin', email: 'e2e_admin@test.com', passwordHash: hash, role: 'admin' },
    });

    testUserId = user.id;

    // Get tokens via login
    const userRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'e2e_user@test.com', password: 'TestPass1!' });
    userToken = userRes.body.data?.accessToken ?? userRes.body.accessToken;

    const adminRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'e2e_admin@test.com', password: 'TestPass1!' });
    adminToken = adminRes.body.data?.accessToken ?? adminRes.body.accessToken;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({ where: { email: { in: ['e2e_user@test.com', 'e2e_admin@test.com'] } } });
    if (testAnimeId) await prisma.anime.delete({ where: { id: testAnimeId } }).catch(() => null);
    await app.close();
  });

  // ── Auth ───────────────────────────────────────────────────
  describe('POST /auth/register', () => {
    it('rejects weak passwords', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ username: 'newuser', email: 'new@test.com', password: 'weak' });
      expect(res.status).toBe(400);
    });

    it('rejects duplicate email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ username: 'other', email: 'e2e_user@test.com', password: 'TestPass1!' });
      expect(res.status).toBe(409);
    });
  });

  // ── Anime catalog (public) ─────────────────────────────────
  describe('GET /anime', () => {
    it('returns paginated anime list', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/anime');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('pagination');
    });

    it('filters by search query', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/anime?search=naruto');
      expect(res.status).toBe(200);
    });
  });

  // ── Anime CRUD (admin) ────────────────────────────────────
  describe('POST /anime (admin only)', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/anime')
        .send({ title: 'Test Anime', status: 'completed' });
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin users', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/anime')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'Test Anime', status: 'completed' });
      expect(res.status).toBe(403);
    });

    it('creates anime as admin', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/anime')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'E2E Test Anime', status: 'completed', hasDub: true, releaseYear: 2020 });

      expect(res.status).toBe(201);
      testAnimeId = res.body.data?.id ?? res.body.id;
      expect(testAnimeId).toBeDefined();
    });
  });

  // ── Ratings ────────────────────────────────────────────────
  describe('POST /anime/:id/ratings', () => {
    it('requires authentication', async () => {
      if (!testAnimeId) return;
      const res = await request(app.getHttpServer())
        .post(`/api/v1/anime/${testAnimeId}/ratings`)
        .send({ subRating: 4 });
      expect(res.status).toBe(401);
    });

    it('saves a sub rating', async () => {
      if (!testAnimeId) return;
      const res = await request(app.getHttpServer())
        .post(`/api/v1/anime/${testAnimeId}/ratings`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ subRating: 5 });
      expect(res.status).toBe(201);
      expect(res.body.data?.subRating ?? res.body.subRating).toBe(5);
    });

    it('rejects ratings outside 1–5', async () => {
      if (!testAnimeId) return;
      const res = await request(app.getHttpServer())
        .post(`/api/v1/anime/${testAnimeId}/ratings`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ subRating: 6 });
      expect(res.status).toBe(400);
    });

    it('upserts — second POST updates the rating', async () => {
      if (!testAnimeId) return;
      const res = await request(app.getHttpServer())
        .post(`/api/v1/anime/${testAnimeId}/ratings`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ subRating: 3 });
      expect(res.status).toBe(201);
      expect(res.body.data?.subRating ?? res.body.subRating).toBe(3);
    });

    it('returns the user's rating via GET /me', async () => {
      if (!testAnimeId) return;
      const res = await request(app.getHttpServer())
        .get(`/api/v1/anime/${testAnimeId}/ratings/me`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
    });
  });

  // ── Input validation hardening ─────────────────────────────
  describe('Input validation', () => {
    it('strips unknown fields from request body', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'e2e_user@test.com', password: 'TestPass1!', __proto__: { isAdmin: true }, role: 'admin' });
      // Should succeed with login — injected fields stripped
      expect(res.status).toBe(200);
      expect(res.body.data?.user?.role ?? res.body.user?.role).toBe('user');
    });

    it('rejects SQL injection in search query', async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/anime?search='; DROP TABLE anime; --");
      // Should return 200 with empty results, not 500
      expect(res.status).toBe(200);
    });
  });
});
