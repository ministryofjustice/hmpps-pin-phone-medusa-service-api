import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { addToCartWorkflow } from '@medusajs/medusa/core-flows'
import { Modules, ModuleRegistrationName } from '@medusajs/framework/utils'

/**
 * @oas [post] /internal/pin-phone/carts/{id}/add-items
 * operationId: addPinPhoneToCart
 * summary: Add PIN phone credit to cart
 * description: Adds a PIN phone credit item to the specified cart with the given amount.
 * parameters:
 *   - in: path
 *     name: id
 *     required: true
 *     schema:
 *       type: string
 *     description: The cart ID
 * requestBody:
 *   required: true
 *   content:
 *     application/json:
 *       schema:
 *         $ref: '#/components/schemas/AddItemsRequest'
 * responses:
 *   200:
 *     description: Item added to cart successfully
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/CartResponse'
 *   404:
 *     description: PIN Phone variant not found
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/ErrorResponse'
 *   500:
 *     description: Failed to add pin phone to cart
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/ErrorResponse'
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { id: cartId } = req.params
    const { amount } = req.body as { amount: number }

    const productModule = req.scope.resolve(ModuleRegistrationName.PRODUCT)
    const cartModule = req.scope.resolve(Modules.CART)

    // Fetch the PIN-PHONE-CREDIT variant
    const [pinPhoneVariant] = await productModule.listProductVariants({
      sku: 'PIN-PHONE-CREDIT',
    })

    if (!pinPhoneVariant) {
      return res.status(404).json({
        status: 404,
        errorCode: 'VARIANT_NOT_FOUND',
        userMessage: 'PIN Phone variant not found. Please check the SKU and try again.',
        developerMessage: 'No variant found with SKU PIN-PHONE-CREDIT',
      })
    }

    const penceToPounds = (pence: number): number => pence / 100
    // Add item to cart
    await addToCartWorkflow(req.scope).run({
      input: {
        cart_id: cartId,
        items: [
          {
            variant_id: pinPhoneVariant.id,
            quantity: 1,
            unit_price: penceToPounds(amount),
            requires_shipping: false,
          },
        ],
      },
    })

    // Retrieve updated cart
    const cart = await cartModule.retrieveCart(cartId, {
      relations: ['items'],
    })
    return res.status(200).json({ cart })
  } catch (error) {
    return res.status(500).json({
      status: 500,
      errorCode: 'ADD_TO_CART_FAILED',
      userMessage: 'Failed to add pin phone to cart',
      developerMessage: error instanceof Error ? error.message : String(error),
    })
  }
}
