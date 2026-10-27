module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  testPathIgnorePatterns: ['/dist/'],
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  // The service suites share one PostgreSQL test database (DATABASE_URL_TEST),
  // migrated once per run and wiped between tests, so they run one at a time.
  globalSetup: '<rootDir>/test/global-setup.js',
  maxWorkers: 1,
  // Each test talks to PostgreSQL; on a busy machine setup can pass Jest's 5s default.
  testTimeout: 20_000,
};
