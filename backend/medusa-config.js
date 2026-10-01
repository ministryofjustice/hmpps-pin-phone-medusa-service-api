const { loadEnv, defineConfig } = require('@medusajs/framework/utils')

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

const isBuildTime = process.env.CI === 'true'
const isProduction = process.env.NODE_ENV === 'production'

const getDatabaseUrl = () => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  if (isBuildTime) {
    return 'postgres://postgres:postgres@localhost:5432/postgres'
  }

  const { DB_USER, DB_PASSWORD, DB_SERVER, DB_NAME, DB_PORT = '5432' } = process.env

  if (!DB_USER || !DB_PASSWORD || !DB_SERVER || !DB_NAME) {
    throw new Error('Database configuration missing. Required: DB_USER, DB_PASSWORD, DB_SERVER, DB_NAME')
  }

  return `postgres://${DB_USER}:${DB_PASSWORD}@${DB_SERVER}:${DB_PORT}/${DB_NAME}`
}

const getRedisUrl = () => {
  if (process.env.REDIS_AUTH_TOKEN) {
    return `rediss://:${process.env.REDIS_AUTH_TOKEN}@${process.env.REDIS_PRIMARY_ENDPOINT}:6379`
  }
  return process.env.REDIS_URL
}

const getRedisModules = () => {
  const redisUrl = getRedisUrl()

  if (redisUrl) {
    return [
      {
        resolve: '@medusajs/medusa/cache-redis',
        options: { redisUrl },
      },
      {
        resolve: '@medusajs/medusa/workflow-engine-redis',
        options: { redis: { redisUrl } },
      },
    ]
  }

  return [
    {
      resolve: '@medusajs/medusa/cache-inmemory',
    },
    {
      resolve: '@medusajs/medusa/workflow-engine-inmemory',
    },
  ]
}

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: getDatabaseUrl(),
    databaseDriverOptions: isProduction
      ? {
          connection: {
            ssl: {
              require: true,
              rejectUnauthorized: false,
            },
          },
        }
      : {},
    http: {
      storeCors: process.env.STORE_CORS || '*',
      adminCors: process.env.ADMIN_CORS || '*',
      authCors: process.env.AUTH_CORS || '*',
      jwtSecret: process.env.JWT_SECRET || 'supersecret',
      cookieSecret: process.env.COOKIE_SECRET || 'supersecret',
    },
    cookieOptions: isProduction
      ? {
          secure: true,
          sameSite: 'lax',
          httpOnly: true,
        }
      : undefined,
  },
  modules: [
    ...getRedisModules(),
    {
      resolve: './src/modules/prisoner-details',
      definition: {
        isQueryable: true,
      },
    },
    {
      resolve: '@medusajs/medusa/payment',
      options: {
        providers: [
          {
            id: 'bt-payment',
            resolve: './src/modules/bt-payment',
            options: {
              clientName: 'Digital Canteen Medusa',
            },
          },
        ],
      },
    },
  ],
  admin: {
    disable: process.env.DISABLE_MEDUSA_ADMIN === 'true',
    backendUrl: process.env.MEDUSA_BACKEND_URL !== undefined ? process.env.MEDUSA_BACKEND_URL : 'http://localhost:9000',
  },
})
