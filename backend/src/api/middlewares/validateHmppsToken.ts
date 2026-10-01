import * as jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

const REQUIRED_ROLE = 'ROLE_PIN_PHONE_CREDIT_API'

export async function validateHmppsToken(req, res, next) {
  const { HMPPS_AUTH_URL } = process.env
  if (!HMPPS_AUTH_URL) {
    throw new Error('HMPPS_AUTH_URL environment variable is not set')
  }

  const client = jwksClient({
    jwksUri: `${HMPPS_AUTH_URL}/.well-known/jwks.json`,
    cache: true,
    cacheMaxAge: 604800000, // a week
    rateLimit: true,
    jwksRequestsPerMinute: 5,
  })

  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    logger.error('Missing authorization token')
    return res.status(401).json({ message: 'Missing authorization token' })
  }

  const token = authHeader.split(' ')[1]

  const decoded = jwt.decode(token, { complete: true })
  if (!decoded?.header?.kid) {
    return res.status(401).json({
      status: 401,
      errorCode: 'MALFORMED_TOKEN',
      userMessage: 'Malformed token.',
      developerMessage: `Auth failed: Malformed token`,
    })
  }

  try {
    const key = await client.getSigningKey(decoded.header.kid)

    const verified = jwt.verify(token, key.getPublicKey(), {
      algorithms: ['RS256'],
      issuer: `${HMPPS_AUTH_URL}/issuer`,
    }) as {
      client_id?: string
      authorities?: string[]
    }

    const authorities = verified.authorities ?? []
    if (!authorities.includes(REQUIRED_ROLE)) {
      return res.status(403).json({
        status: 403,
        errorCode: 'INSUFFICIENT_ROLES',
        userMessage: 'Insufficient roles.',
        developerMessage: `Auth failed: Insufficient roles`,
      })
    }

    return next()
  } catch (err) {
    const message = err instanceof jwt.TokenExpiredError ? 'Token expired' : 'Invalid token'

    logger.error('Auth failure:', message, err)
    return res.status(401).json({
      status: 401,
      errorCode: 'AUTH_FAILURE',
      userMessage: message,
      developerMessage: `Auth failed: ${message}`,
    })
  }
}
