import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import {
  capturePaymentWorkflow,
  completeOrderWorkflow,
  createOrderFulfillmentWorkflow,
} from '@medusajs/medusa/core-flows'
import { SubscriberArgs } from '@medusajs/framework'
import BtPinPhoneFulfilment from '../BtPinPhoneFulfilment'

jest.mock('@medusajs/medusa/core-flows', () => ({
  capturePaymentWorkflow: jest.fn(),
  completeOrderWorkflow: jest.fn(),
  createOrderFulfillmentWorkflow: jest.fn(),
}))

interface OrderPayment {
  id: string
  captured_at: string | null
}

interface OrderItem {
  id: string
  quantity: number
  variant: {
    product: {
      type: { value: string }
    }
  }
}

interface TestOrder {
  id: string
  items: OrderItem[]
  payment_collections: {
    payments: OrderPayment[]
  }[]
}

const buildSubscriberArgs = (order: TestOrder) => {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }

  const query = {
    graph: jest.fn().mockResolvedValue({ data: [order] }),
  }

  const container = {
    resolve: jest.fn((key: string) => {
      switch (key) {
        case ContainerRegistrationKeys.LOGGER:
          return logger
        case ContainerRegistrationKeys.QUERY:
          return query
        default:
          throw new Error(`Unknown dependency: ${key}`)
      }
    }),
  }

  return { logger, query, container }
}

const mockWorkflow = (workflowFn: jest.Mock, result = {}) => {
  workflowFn.mockReturnValue({
    run: jest.fn().mockResolvedValue({ result }),
  })
}

const mockWorkflowFailure = (workflowFn: jest.Mock, message: string) => {
  workflowFn.mockReturnValue({
    run: jest.fn().mockRejectedValue(new Error(message)),
  })
}

const buildDigitalOrder = (overrides = {}) => ({
  id: 'order_pin_phone',
  items: [
    {
      id: 'pin_phone_item',
      quantity: 1,
      variant: {
        product: {
          type: { value: 'pin-phone-credit-digital-product' },
        },
      },
    },
  ],
  payment_collections: [
    {
      payments: [{ id: 'pay_pin_phone', captured_at: null }],
    },
  ],
  ...overrides,
})

const buildEvent = (orderId: string): SubscriberArgs<{ id: string }>['event'] => ({
  data: { id: orderId },
  name: 'order.placed',
  metadata: {},
})

describe('BtPinPhoneFulfilment subscriber', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockWorkflow(capturePaymentWorkflow as unknown as jest.Mock)
    mockWorkflow(createOrderFulfillmentWorkflow as unknown as jest.Mock)
    mockWorkflow(completeOrderWorkflow as unknown as jest.Mock)
  })

  it('captures payment, creates fulfilment, and completes order', async () => {
    const order = buildDigitalOrder()
    const { container } = buildSubscriberArgs(order)

    await BtPinPhoneFulfilment({
      event: buildEvent('order_pin_phone'),
      container,
    } as unknown as SubscriberArgs<{ id: string }>)

    expect(capturePaymentWorkflow).toHaveBeenCalledWith(container)
    expect((capturePaymentWorkflow as unknown as jest.Mock).mock.results[0].value.run).toHaveBeenCalledWith({
      input: { payment_id: 'pay_pin_phone' },
    })

    expect(createOrderFulfillmentWorkflow).toHaveBeenCalledWith(container)
    expect((createOrderFulfillmentWorkflow as unknown as jest.Mock).mock.results[0].value.run).toHaveBeenCalledWith({
      input: {
        order_id: 'order_pin_phone',
        items: [{ id: 'pin_phone_item', quantity: 1 }],
        no_notification: true,
        requires_shipping: false,
      },
    })

    expect(completeOrderWorkflow).toHaveBeenCalledWith(container)
    expect((completeOrderWorkflow as unknown as jest.Mock).mock.results[0].value.run).toHaveBeenCalledWith({
      input: { orderIds: ['order_pin_phone'] },
    })
  })

  it('skip capturing when payment is already captured', async () => {
    const order = buildDigitalOrder({
      payment_collections: [
        {
          payments: [{ id: 'pay_pin_phone', captured_at: '2025-01-01T00:00:00Z' }],
        },
      ],
    })

    const { container } = buildSubscriberArgs(order)

    await BtPinPhoneFulfilment({
      event: { data: { id: 'order_pin_phone' } },
      container,
    } as unknown as SubscriberArgs<{ id: string }>)

    expect(capturePaymentWorkflow).not.toHaveBeenCalled()
    expect(createOrderFulfillmentWorkflow).toHaveBeenCalled()
  })

  it('returns early when order has no items', async () => {
    const order = buildDigitalOrder({ items: [] })
    const { container, logger } = buildSubscriberArgs(order)

    await BtPinPhoneFulfilment({
      event: { data: { id: 'pay_pin_phone' } },
      container,
    } as unknown as SubscriberArgs<{ id: string }>)

    expect(logger.warn).toHaveBeenCalledWith('No items found for order pay_pin_phone')
    expect(capturePaymentWorkflow).not.toHaveBeenCalled()
    expect(createOrderFulfillmentWorkflow).not.toHaveBeenCalled()
  })

  it('returns early and does not fulfil when capture fails', async () => {
    const order = buildDigitalOrder()
    const { container, logger } = buildSubscriberArgs(order)

    mockWorkflowFailure(capturePaymentWorkflow as unknown as jest.Mock, 'Capture declined')

    await BtPinPhoneFulfilment({
      event: { data: { id: 'pay_pin_phone' } },
      container,
    } as unknown as SubscriberArgs<{ id: string }>)

    expect(logger.error).toHaveBeenCalledWith('Failed to capture payment for order pay_pin_phone: Capture declined')
    expect(createOrderFulfillmentWorkflow).not.toHaveBeenCalled()
    expect(completeOrderWorkflow).not.toHaveBeenCalled()
  })

  it('logs error when fulfilment fails', async () => {
    const order = buildDigitalOrder()
    const { container, logger } = buildSubscriberArgs(order)

    mockWorkflowFailure(createOrderFulfillmentWorkflow as unknown as jest.Mock, 'Fulfilment error')

    await BtPinPhoneFulfilment({
      event: { data: { id: 'pay_pin_phone' } },
      container,
    } as unknown as SubscriberArgs<{ id: string }>)

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to fulfil digital items for order pay_pin_phone: Fulfilment error',
    )
  })
})
