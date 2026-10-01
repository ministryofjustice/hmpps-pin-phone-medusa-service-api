import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { createCartWorkflow } from '@medusajs/medusa/core-flows'
import { Modules, ContainerRegistrationKeys, ModuleRegistrationName } from '@medusajs/framework/utils'
import { PRISONER_MODULE } from '../../../../modules/prisoner-details'

/**
 * @oas [post] /internal/pin-phone/carts
 * operationId: createPinPhoneCart
 * summary: Create a PIN phone cart
 * description: Creates a new cart for a prisoner's PIN phone purchase. If the prisoner
 *   has used the service before, the cart is linked to their existing customer record.
 *   Otherwise, a new customer and prisoner record are created and linked.
 * requestBody:
 *   required: true
 *   content:
 *     application/json:
 *       schema:
 *         $ref: '#/components/schemas/CreateCartRequest'
 * responses:
 *   200:
 *     description: Cart created successfully
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/CartResponse'
 *   404:
 *     description: Region not found
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/ErrorResponse'
 *   500:
 *     description: Failed to create cart
 *     content:
 *       application/json:
 *         schema:
 *           $ref: '#/components/schemas/ErrorResponse'
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { metadata } = req.body as {
      metadata: {
        prison_id: string
        offender_no: string
        first_name: string
        second_name: string
      }
    }

    const { prison_id, offender_no, first_name, second_name } = metadata
    const prisonerService = req.scope.resolve(PRISONER_MODULE)
    const customerService = req.scope.resolve(Modules.CUSTOMER)
    const link = req.scope.resolve(ContainerRegistrationKeys.LINK)
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const regionModuleService = req.scope.resolve(ModuleRegistrationName.REGION)
    const salesChannelModuleService = req.scope.resolve(ModuleRegistrationName.SALES_CHANNEL)

    const [existingPrisoner] = await prisonerService.listPrisoners({
      prison_id,
      prisoner_id: offender_no,
    })

    let customerId: string | undefined
    if (existingPrisoner) {
      const {
        data: [linked],
      } = await query.graph({
        entity: 'prisoner',
        fields: ['customer.*'],
        filters: { id: existingPrisoner.id },
      })
      customerId = linked?.customer?.id
    } else {
      const customer = await customerService.createCustomers({
        first_name,
        last_name: second_name,
        metadata: {
          prison_id,
          offender_no,
        },
        has_account: false,
      })
      const prisoner = await prisonerService.createPrisoners({
        prison_id,
        prisoner_id: offender_no,
        prisoner_first_name: first_name,
        prisoner_second_name: second_name,
      })
      await link.create({
        [Modules.CUSTOMER]: { customer_id: customer.id },
        [PRISONER_MODULE]: { prisoner_id: prisoner.id },
      })
      customerId = customer.id
    }

    // Create cart using Pin Phone Credit region
    const [region] = await regionModuleService.listRegions({ name: 'Pin Phone Credit - United Kingdom' })

    // Create cart using Pin Phone Sales Channel
    const [salesChannel] = await salesChannelModuleService.listSalesChannels({
      name: 'Pin Phone Credit Sales Channel',
    })

    if (!region) {
      return res.status(404).json({
        status: 404,
        errorCode: 'REGION_NOT_FOUND',
        userMessage: 'Unable to create cart.',
        developerMessage: 'Region "Pin Phone Credit - United Kingdom" not found',
      })
    }

    const { result } = await createCartWorkflow(req.scope).run({
      input: {
        region_id: region.id,
        sales_channel_id: salesChannel.id,
        customer_id: customerId,
        metadata: { order_type: 'PIN_PHONE' },
      },
    })

    return res.status(200).json({ cart: result })
  } catch (error) {
    return res.status(500).json({
      status: 500,
      errorCode: 'CREATE_CART_FAILED',
      userMessage: 'Failed to create cart.',
      developerMessage: `createCartWorkflow failed: ${(error as Error).message}`,
    })
  }
}
