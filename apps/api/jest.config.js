module.exports = {
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  transform: { '^.+\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }] },
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  testEnvironment: 'node',
};
