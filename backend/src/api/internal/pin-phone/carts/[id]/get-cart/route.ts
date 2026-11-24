import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

/**
 * @openapi
 * /internal/pin-phone/carts/{id}/get-cart:
 *   post:
 *     operationId: getCart
 *     summary: Gets an existing cart
 *     description: Gets an existing cart
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The cart ID
 *     responses:
 *       200:
 *         description: Cart retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GetCartResponse'
 *       404:
 *         description: Cart not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Failed to add pin phone to cart
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id: cartId } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const {
      data: [cart],
    } = await query.graph({
      entity: 'cart',
      fields: ['id', 'completed_at', 'metadata', 'order.id'],
      filters: { id: cartId },
    })

    if (!cart) {
      return res.status(404).json({
        status: 404,
        errorCode: 'CART_NOT_FOUND',
        userMessage: 'Cart not found',
        developerMessage: `Cart ${cartId} does not exist`,
      })
    }

    return res.status(200).json({
      cartId: cart.id,
      completed: cart.completed_at != null,
      completedAt: cart.completed_at ?? null,
      orderId: cart.order?.id ?? null,
      offenderNo: cart.metadata?.offenderNo ?? null,
    })
  } catch (error) {
    return res.status(500).json({
      status: 500,
      errorCode: 'GET_CART_FAILED',
      userMessage: 'Failed to get cart',
      developerMessage: error instanceof Error ? error.message : String(error),
    })
  }
}
