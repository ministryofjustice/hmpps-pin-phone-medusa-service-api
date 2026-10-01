import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'

import { createPaymentCollectionForCartWorkflow, completeCartWorkflow } from '@medusajs/medusa/core-flows'
import { POST } from '../route'

jest.mock('@medusajs/medusa/core-flows', () => ({
  createPaymentCollectionForCartWorkflow: jest.fn(),
  completeCartWorkflow: jest.fn(),
}))

describe('POST /internal/pin-phone/carts/:id/complete', () => {
  let req: any
  let res: any
  let logger: any
  let cartModuleService: any
  let paymentModuleService: any

  const validPaymentRequest = {
    amountPence: 1000,
    offenderNo: 'G916XXX',
    prisonId: 'MDI',
    paymentStatus: 'AUTHORIZED',
    financeTransactionReference: '12345',
    financeHoldNumber: '54321',
    btCreditLimitPence: '50000',
    btPreBalancePence: 1000,
    btNewBalancePence: 2000,
    errorCode: null,
    errorMessage: null,
  }

  beforeEach(() => {
    // Mock logger
    logger = { warn: jest.fn(), info: jest.fn(), error: jest.fn() }

    // Mock services
    cartModuleService = {
      retrieveCart: jest.fn().mockResolvedValue({
        id: 'cart_123',
        items: [],
      }),
    }

    paymentModuleService = {
      createPaymentSession: jest.fn().mockResolvedValue({
        id: 'pay_session_123',
      }),
    }

    const mockedCreatePaymentCollectionForCartWorkflow = createPaymentCollectionForCartWorkflow as unknown as jest.Mock

    const mockedCompleteCartWorkflow = completeCartWorkflow as unknown as jest.Mock

    mockedCreatePaymentCollectionForCartWorkflow.mockReturnValue({
      run: jest.fn().mockResolvedValue({
        result: { id: 'payment_collection_123' },
      }),
    })

    mockedCompleteCartWorkflow.mockReturnValue({
      run: jest.fn().mockResolvedValue({
        result: { id: 'order_123' },
      }),
    })

    // Mock container scope
    req = {
      params: { id: 'cart_123' },
      body: {
        PaymentRequest: validPaymentRequest,
      },
      scope: {
        resolve: jest.fn(key => {
          switch (key) {
            case ContainerRegistrationKeys.LOGGER:
              return logger
            case Modules.CART:
              return cartModuleService
            case Modules.PAYMENT:
              return paymentModuleService
            case 'createPaymentCollectionForCartWorkflow':
              return createPaymentCollectionForCartWorkflow
            case 'completeCartWorkflow':
              return completeCartWorkflow
            default:
              throw new Error(`Unknown dependency: ${key}`)
          }
        }),
      },
    }

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }
  })

  it('returns 200 and completes the cart when items exist', async () => {
    cartModuleService.retrieveCart.mockResolvedValue({
      id: 'cart_123',
      items: [{ unit_price: 500 }],
    })

    await POST(req, res)

    expect(cartModuleService.retrieveCart).toHaveBeenCalledWith('cart_123', {
      relations: ['items'],
    })

    expect(paymentModuleService.createPaymentSession).toHaveBeenCalledWith(
      'payment_collection_123',
      expect.objectContaining({
        provider_id: 'pp_bt-payment_bt-payment',
        amount: 500,
        currency_code: 'gbp',
        data: { ...validPaymentRequest },
      }),
    )

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      cartId: 'cart_123',
      orderId: 'order_123',
      orderStatusRecorded: true,
      paymentSuccessful: true,
    })
  })

  it('returns 404 and returns error when no cart retrieved', async () => {
    cartModuleService.retrieveCart.mockRejectedValue(new Error('Missing cart'))

    req.body.PaymentRequest = validPaymentRequest

    await POST(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({
      status: 404,
      errorCode: 'CART_NOT_FOUND',
      developerMessage: 'Could not retrieve cart cart_123: Missing cart',
      userMessage: 'Cart not found',
    })
  })

  it('returns 500 when payment collection creation fails', async () => {
    cartModuleService.retrieveCart.mockResolvedValue({
      id: 'cart_123',
      items: [{ unit_price: 500 }],
    })

    const mockedCreatePaymentCollectionForCartWorkflow = createPaymentCollectionForCartWorkflow as unknown as jest.Mock
    mockedCreatePaymentCollectionForCartWorkflow.mockReturnValue({
      run: jest.fn().mockRejectedValue(new Error('Payment collection failed')),
    })

    await POST(req, res)

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to create payment collection for cart cart_123: Payment collection failed',
    )

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      status: 500,
      errorCode: 'PAYMENT_COLLECTION_FAILED',
      userMessage: 'Unable to process payment at this time',
      developerMessage: 'Payment collection creation failed for cart cart_123: Payment collection failed',
    })
  })

  it('returns 500 and returns error on cart completion error', async () => {
    cartModuleService.retrieveCart.mockResolvedValue({
      id: 'cart_123',
      items: [{ unit_price: 500 }],
    })

    req.body.PaymentRequest = validPaymentRequest

    const mockedCompleteCartWorkflow = completeCartWorkflow as unknown as jest.Mock
    mockedCompleteCartWorkflow.mockReturnValue({
      run: jest.fn().mockRejectedValue(new Error('Some medusa issue')),
    })

    await POST(req, res)

    expect(logger.error).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      status: 500,
      errorCode: 'CART_COMPLETION_FAILED',
      developerMessage: 'completeCartWorkflow failed for cart cart_123: Some medusa issue',
      userMessage: 'Order could not be completed within medusa',
    })
  })

  it('Returns early with error when no cart items exist', async () => {
    cartModuleService.retrieveCart.mockResolvedValue({
      id: 'cart_123',
      items: [],
    })

    await POST(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      status: 400,
      errorCode: 'EMPTY_CART',
      developerMessage: 'Cart cart_123 contains no line items',
      userMessage: 'Cart has no items',
    })
  })
})
