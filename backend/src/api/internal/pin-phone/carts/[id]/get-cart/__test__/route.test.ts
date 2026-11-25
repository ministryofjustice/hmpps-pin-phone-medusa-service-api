import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { GET } from '../route'

describe('GET handler - /internal/pin-phone/carts/:id/get-cart', () => {
  let req: any
  let res: any
  let queryService: any
  let container: any

  beforeEach(() => {
    queryService = {
      graph: jest.fn(),
    }

    container = {
      resolve: jest.fn(key => {
        switch (key) {
          case ContainerRegistrationKeys.QUERY:
            return queryService
          default:
            throw new Error(`Unknown dependency: ${key}`)
        }
      }),
    }

    req = {
      params: { id: 'cart_123' },
      scope: container,
    }
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }
  })

  it('returns completed cart with order details', async () => {
    queryService.graph.mockResolvedValue({
      data: [
        {
          id: 'cart_123',
          completed_at: '2026-11-24T10:00:00Z',
          metadata: { offenderNo: 'A1234BC' },
          order: { id: 'order_01XYZ' },
        },
      ],
    })
    await GET(req, res)

    expect(queryService.graph).toHaveBeenCalledWith({
      entity: 'cart',
      fields: ['id', 'completed_at', 'metadata', 'order.id'],
      filters: { id: 'cart_123' },
    })

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      cartId: 'cart_123',
      completed: true,
      completedAt: '2026-11-24T10:00:00Z',
      orderId: 'order_01XYZ',
      offenderNo: 'A1234BC',
    })
  })

  it('returns incomplete cart with null fields', async () => {
    queryService.graph.mockResolvedValue({
      data: [
        {
          id: 'cart_123',
          completed_at: null,
          metadata: { offenderNo: 'A1234BC' },
          order: null,
        },
      ],
    })
    await GET(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      cartId: 'cart_123',
      completed: false,
      completedAt: null,
      orderId: null,
      offenderNo: 'A1234BC',
    })
  })

  it('returns 404 when cart does not exist', async () => {
    queryService.graph.mockResolvedValue({ data: [undefined] })
    await GET(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({
      status: 404,
      errorCode: 'CART_NOT_FOUND',
      userMessage: 'Cart not found',
      developerMessage: 'Cart cart_123 does not exist',
    })
  })

  it('returns 500 on unexpected error', async () => {
    queryService.graph.mockRejectedValue(new Error('DB connection lost'))
    await GET(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      status: 500,
      errorCode: 'GET_CART_FAILED',
      userMessage: 'Failed to get cart',
      developerMessage: 'DB connection lost',
    })
  })
})
