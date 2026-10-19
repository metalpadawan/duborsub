import { z } from 'zod';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

function parseBoolean(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return value;
}

function parseInteger(value: unknown) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    return Number.parseInt(value, 10);
  }

  return value;
}

function isLocalUrl(value: string) {
  const parsed = new URL(value);
  return parsed.protocol === 'http:' && LOCAL_HOSTNAMES.has(parsed.hostname);
}

function isSecureUrl(value: string) {
  const parsed = new URL(value);
  return parsed.protocol === 'https:';
}

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.preprocess(
    parseInteger,
    z.number().int().min(1).max(65535),
  ).default(4000),
  FRONTEND_URL: z.string().trim().url().default('http://localhost:3000'),
  JWT_SECRET: z
    .string()
    .trim()
    .min(32, 'JWT_SECRET must be at least 32 characters long')
    .refine(
      (value) => !value.includes('CHANGE_ME') && value !== 'dev-secret-change-me',
      'JWT_SECRET must be replaced with a strong random secret',
    ),
  JWT_ISSUER: z.string().trim().min(1).default('anirate-api'),
  JWT_AUDIENCE: z.string().trim().min(1).default('anirate-web'),
  ACCESS_TOKEN_TTL_MINUTES: z.preprocess(
    parseInteger,
    z.number().int().min(5).max(60),
  ).default(10),
  REFRESH_TOKEN_TTL_HOURS: z.preprocess(
    parseInteger,
    z.number().int().min(1).max(168),
  ).default(24),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_SECURE: z.preprocess(parseBoolean, z.boolean()).optional(),
  TRUST_PROXY: z.preprocess(parseBoolean, z.boolean()).default(false),
  DATA_FILE: z.string().trim().min(1).optional(),
  EXPOSE_RESET_TOKEN:z.preprocess(parseBoolean, z.boolean()).default(false),
  SEED_ADMIN_EMAIL: z.string().trim().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(12, 'SEED_ADMIN_PASSWORD must be at least 12 characters long').optional(),
});

export function validateEnvironment(config: Record<string, unknown>) {
  const parsed = environmentSchema.parse(config);
  const cookieSecure = parsed.COOKIE_SECURE ?? parsed.NODE_ENV === 'production';

  if (parsed.NODE_ENV === 'production' && !isSecureUrl(parsed.FRONTEND_URL)) {
    throw new Error('FRONTEND_URL must use HTTPS in production');
  }

  if (
    !isSecureUrl(parsed.FRONTEND_URL) &&
    !isLocalUrl(parsed.FRONTEND_URL)
  ) {
    throw new Error('FRONTEND_URL must use HTTPS unless it points to localhost');
  }

  if (parsed.NODE_ENV === 'production' && parsed.EXPOSE_RESET_TOKEN) {
    throw new Error('EXPOSE_RESET_TOKEN must not be enabled in production');
  }

  if (parsed.COOKIE_SAME_SITE === 'none' && !cookieSecure) {
    throw new Error('COOKIE_SECURE must be true when COOKIE_SAME_SITE is set to "none"');
  }

  return {
    ...parsed,
    COOKIE_SECURE: cookieSecure,
  };
}
