const { loadEnv } = require('@medusajs/utils')

loadEnv('test', process.cwd())

process.env.HMPPS_AUTH_URL = 'https://auth.test.com'

module.exports = {
  transform: {
    '^.+\\.[jt]s$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', decorators: true },
        },
      },
    ],
  },
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'ts', 'json'],
  modulePathIgnorePatterns: ['dist/', '<rootDir>/.medusa/'],
  testMatch: ['**/src/**/__test__/**/*.[jt]s'],
}
