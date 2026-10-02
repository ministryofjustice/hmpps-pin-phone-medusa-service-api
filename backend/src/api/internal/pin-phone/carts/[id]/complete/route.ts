import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { createPaymentCollectionForCartWorkflow, completeCartWorkflow } from '@medusajs/medusa/core-flows'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'

export interface PaymentRequest {
  amountPence: number
  offenderNo: string
  prisonId: string
  paymentStatus: 'AUTHORIZED' | 'ERROR'
  financeTransactionReference?: string
  financeHoldNumber?: number
  btCreditLimitPence: number
  btPreBalancePence: number
  btNewBalancePence: number
  errorCode?: string
  errorMessage?: string
}

interface ErrorResponse {
  status: number
  errorCode?: string
  userMessage?: string
  developerMessage?: string
  moreInfo?: string
}

function buildErrorResponse(status: number, opts: Omit<ErrorResponse, 'status'> = {}): ErrorResponse {
  return { status, ...opts }
}

/**
 * @oas [post] /internal/pin-phone/carts/{id}/complete
 * operationId: completePinPhoneCart
 * summary: Complete a PIN phone cart
 * description: "Completes a PIN phone cart by processing the BT payment result and running the transaction"
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
 *         type: object
 *         required:
 *           - PaymentRequest
 *         properties:
 *           PaymentRequest:
 *             $ref: '#/components/schemas/PaymentRequest'
 * responses:
 *   200:
 *     description: Payment outcome recorded
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/CompleteCartResponse'
 *   400:
 *     description: Invalid request
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/ErrorResponse'
 *   404:
 *     description: Cart not found
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/ErrorResponse'
 *   500:
 *     description: Internal error
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/ErrorResponse'
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const { PaymentRequest: paymentRequest } = req.body as { PaymentRequest: PaymentRequest }
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  // Retrieve cart
  const cartModuleService = req.scope.resolve(Modules.CART)
  let cart

  try {
    cart = await cartModuleService.retrieveCart(id, { relations: ['items'] })
  } catch (err) {
    logger.error(`Failed to retrieve cart ${id}: ${(err as Error).message}`)
    return res.status(404).json(
      buildErrorResponse(404, {
        errorCode: 'CART_NOT_FOUND',
        userMessage: 'Cart not found',
        developerMessage: `Could not retrieve cart ${id}: ${(err as Error).message}`,
      }),
    )
  }

  if (!cart?.items?.length) {
    return res.status(400).json(
      buildErrorResponse(400, {
        errorCode: 'EMPTY_CART',
        userMessage: 'Cart has no items',
        developerMessage: `Cart ${id} contains no line items`,
      }),
    )
  }
  const amount = cart.items[0].unit_price

  // Create payment collection
  let paymentCollectionId: string
  try {
    const paymentCollection = await createPaymentCollectionForCartWorkflow(req.scope).run({
      input: { cart_id: id },
    })
    paymentCollectionId = paymentCollection.result.id
  } catch (err) {
    logger.error(`Failed to create payment collection for cart ${id}: ${(err as Error).message}`)
    return res.status(500).json(
      buildErrorResponse(500, {
        errorCode: 'PAYMENT_COLLECTION_FAILED',
        userMessage: 'Unable to process payment at this time',
        developerMessage: `Payment collection creation failed for cart ${id}: ${(err as Error).message}`,
      }),
    )
  }

  // Calls BtPaymentProviderService.initiatePayment which stores the payment
  // sets status: PENDING for authorised,
  // ERROR for failed for unauthorised i.e. where payment had failed, stored for audit/history in medusa DB
  try {
    const paymentModuleService = req.scope.resolve(Modules.PAYMENT)
    await paymentModuleService.createPaymentSession(paymentCollectionId, {
      provider_id: 'pp_bt-payment_bt-payment',
      amount,
      currency_code: 'gbp',
      data: { ...paymentRequest },
    })
  } catch (err) {
    logger.error(`Failed to create payment session for cart ${id}: ${(err as Error).message}`)
    return res.status(500).json(
      buildErrorResponse(500, {
        errorCode: 'PAYMENT_SESSION_FAILED',
        userMessage: 'Unable to process payment at this time',
        developerMessage: `Payment session creation failed for cart ${id}: ${(err as Error).message}`,
      }),
    )
  }

  // Do no complete cart for unauthorised payments
  if (paymentRequest.paymentStatus !== 'AUTHORIZED') {
    logger.warn(
      `Payment not authorised for cart ${id}: status=${paymentRequest.paymentStatus}, ` +
        `errorCode=${paymentRequest.errorCode}, errorMessage=${paymentRequest.errorMessage}`,
    )
    return res.status(200).json({
      paymentSuccessful: false,
      orderStatusRecorded: true,
      orderId: null,
      cartId: id,
    })
  }

  // Complete the cart and create the order
  // Calls BtPaymentProviderService.authorizePayment
  try {
    const { result } = await completeCartWorkflow(req.scope).run({ input: { id } })

    return res.status(200).json({
      paymentSuccessful: true,
      orderStatusRecorded: true,
      orderId: result.id,
      cartId: id,
    })
  } catch (err) {
    logger.error(`Cart completion failed for cart ${id}: ${(err as Error).message}`)
    return res.status(500).json(
      buildErrorResponse(500, {
        errorCode: 'CART_COMPLETION_FAILED',
        userMessage: 'Order could not be completed within medusa',
        developerMessage: `completeCartWorkflow failed for cart ${id}: ${(err as Error).message}`,
      }),
    )
  }
}
