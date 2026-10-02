import { PaymentSessionStatus } from '@medusajs/framework/utils'
import type {
  AuthorizePaymentInput,
  CapturePaymentInput,
  InitiatePaymentInput,
  Logger,
} from '@medusajs/framework/types'
import BtPaymentProviderService from '../BtPaymentProviderService'

const buildBtPaymentProvider = () => {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as Logger

  const container: { logger: Logger } = {
    logger,
  }

  const btPaymentProviderService = new BtPaymentProviderService(container, {})
  return { btPaymentProviderService, logger }
}

describe('BtPaymentProviderService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('initiate payment', () => {
    it('returns a pending session with a generated id', async () => {
      const { btPaymentProviderService } = buildBtPaymentProvider()

      const result = await btPaymentProviderService.initiatePayment({
        data: { offenderNo: 'ABC123', paymentStatus: 'AUTHORIZED' },
      } as unknown as InitiatePaymentInput)

      expect(result.id).toMatch(/^bt_/)
      expect(result.status).toBe(PaymentSessionStatus.PENDING)
      expect(result.data).toMatchObject({ offenderNo: 'ABC123' })
    })

    it('throws error when offenderNo is missing', async () => {
      const { btPaymentProviderService } = buildBtPaymentProvider()

      await expect(
        btPaymentProviderService.initiatePayment({ data: { status: 'AUTHORIZED' } } as unknown as InitiatePaymentInput),
      ).rejects.toThrow('Missing required offenderNo')
    })
  })

  describe('authorize payment', () => {
    it('returns AUTHORIZED when status is authorised', async () => {
      const { btPaymentProviderService } = buildBtPaymentProvider()

      const result = await btPaymentProviderService.authorizePayment({
        data: {
          amountPence: 1000,
          offenderNo: 'ABC123',
          prisonId: 'MDI',
          paymentStatus: 'AUTHORIZED',
          financeTransactionReference: '12345',
          financeHoldNumber: '123456',
          btCreditLimitPence: '50000',
          btPreBalancePence: 1000,
          btNewBalancePence: 2000,
          errorCode: null,
          errorMessage: null,
        },
      } as unknown as AuthorizePaymentInput)

      expect(result.status).toBe(PaymentSessionStatus.AUTHORIZED)
      expect(result.data).toMatchObject({
        financeHoldNumber: '123456',
      })
    })

    it('returns ERROR when status is error', async () => {
      const { btPaymentProviderService } = buildBtPaymentProvider()

      const result = await btPaymentProviderService.authorizePayment({
        data: {
          amountPence: 1000,
          offenderNo: 'ABC123',
          prisonId: 'MDI',
          status: 'ERROR',
          transactionReference: '12345',
          holdNumber: '123456',
          errorCode: null,
          errorMessage: null,
        },
      } as unknown as AuthorizePaymentInput)

      expect(result.status).toBe('error')
    })
  })

  describe('capture payment', () => {
    it('returns with a captured_at timestamp', async () => {
      const { btPaymentProviderService } = buildBtPaymentProvider()

      const result = await btPaymentProviderService.capturePayment({
        data: { offender_no: 'ABC123' },
      } as unknown as CapturePaymentInput)

      expect(result.data).toHaveProperty('captured_at')
      expect(new Date(result.data!.captured_at as string).getTime()).not.toBeNaN()
    })
  })

  describe('unimplemented methods', () => {
    const methods = [
      'cancelPayment',
      'deletePayment',
      'updatePayment',
      'getPaymentStatus',
      'retrievePayment',
      'refundPayment',
      'getWebhookActionAndData',
    ] as const

    it.each(methods)('%s throws not implemented', async method => {
      const { btPaymentProviderService } = buildBtPaymentProvider()
      await expect(btPaymentProviderService[method]()).rejects.toThrow('not implemented')
    })
  })
})
