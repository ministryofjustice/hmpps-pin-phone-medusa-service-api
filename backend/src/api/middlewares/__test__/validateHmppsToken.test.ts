import * as jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'
import { validateHmppsToken } from '../validateHmppsToken'

jest.mock('jwks-rsa', () => {
  const fn = jest.fn()
  return {
    __esModule: true,
    default: jest.fn(() => ({ getSigningKey: fn })),
  }
})

jest.mock('jsonwebtoken', () => {
  const MockTokenExpiredError = class extends Error {
    name = 'TokenExpiredError'
  }
  return {
    decode: jest.fn(),
    verify: jest.fn(),
    TokenExpiredError: MockTokenExpiredError,
  }
})

const mockGetSigningKey: jest.Mock = (jwksClient as unknown as jest.Mock)().getSigningKey

const mockLogger = { error: jest.fn() }

function buildReq(authHeader?: string) {
  return {
    headers: { authorization: authHeader },
    scope: { resolve: jest.fn(() => mockLogger) },
  } as any
}

function buildRes() {
  const res: any = { status: jest.fn(), json: jest.fn() }
  res.status.mockReturnValue(res)
  return res
}

const jwtDecode = jwt.decode as jest.Mock
const jwtVerify = jwt.verify as jest.Mock

beforeEach(() => jest.clearAllMocks())

describe('validateHmppsToken', () => {
  it('rejects when there is no Authorization header', async () => {
    const res = buildRes()
    await validateHmppsToken(buildReq(undefined), res, jest.fn())

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ message: 'Missing authorization token' })
  })

  it('rejects when the header is not a Bearer token', async () => {
    const res = buildRes()
    await validateHmppsToken(buildReq('Basic abc'), res, jest.fn())

    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('next when the token is valid and has  required role', async () => {
    jwtDecode.mockReturnValue({ header: { kid: 'key' } })
    mockGetSigningKey.mockResolvedValue({ getPublicKey: () => 'public-key' })
    jwtVerify.mockReturnValue({
      client_id: 'digital-canteen-client',
      authorities: ['ROLE_PIN_PHONE_CREDIT_API'],
    })

    const res = buildRes()
    const next = jest.fn()

    await validateHmppsToken(buildReq('Bearer token'), res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()

    expect(jwt.verify).toHaveBeenCalledWith('token', 'public-key', {
      algorithms: ['RS256'],
      issuer: `${process.env.HMPPS_AUTH_URL}/issuer`,
    })
  })

  it('returns 403 when no required role', async () => {
    jwtDecode.mockReturnValue({ header: { kid: 'key' } })
    mockGetSigningKey.mockResolvedValue({ getPublicKey: () => 'token' })
    jwtVerify.mockReturnValue({
      authorities: ['ROLE_BANANA'],
    })

    const res = buildRes()
    await validateHmppsToken(buildReq('Bearer token'), res, jest.fn())

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({
      status: 403,
      errorCode: 'INSUFFICIENT_ROLES',
      userMessage: 'Insufficient roles.',
      developerMessage: `Auth failed: Insufficient roles`,
    })
  })

  it('returns 401 with "Token expired" for expired tokens', async () => {
    jwtDecode.mockReturnValue({ header: { kid: 'key' } })
    mockGetSigningKey.mockResolvedValue({ getPublicKey: () => 'token' })
    jwtVerify.mockImplementation(() => {
      throw new (jwt.TokenExpiredError as any)('jwt expired')
    })

    const res = buildRes()
    await validateHmppsToken(buildReq('Bearer token'), res, jest.fn())

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({
      status: 401,
      errorCode: 'AUTH_FAILURE',
      userMessage: 'Token expired',
      developerMessage: `Auth failed: Token expired`,
    })
  })
})
