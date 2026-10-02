import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import {
  capturePaymentWorkflow,
  completeOrderWorkflow,
  createOrderFulfillmentWorkflow,
} from '@medusajs/medusa/core-flows'

const PIN_PHONE_PRODUCT_TYPE = 'pin-phone-credit-digital-product'

export default async function BtPinPhoneFulfilment({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const orderId = data.id

  logger.info(`Processing digital order ${orderId}...`)

  const {
    data: [order],
  } = await query.graph({
    entity: 'order',
    fields: [
      'id',
      'items.*',
      'items.variant.product.type.*',
      'payment_collections.*',
      'payment_collections.payments.*',
    ],
    filters: { id: orderId },
  })

  if (!order?.items?.length) {
    logger.warn(`No items found for order ${orderId}`)
    return
  }
  const digitalItems = order.items
    .filter((item): item is NonNullable<typeof item> => item != null)
    .filter(item => item?.variant?.product?.type?.value === PIN_PHONE_PRODUCT_TYPE)

  try {
    const paymentCollection = order.payment_collections?.[0]
    const payment = paymentCollection?.payments?.find(paymentInfo => paymentInfo?.captured_at === null)
    if (payment) {
      logger.info(`Capturing payment for order ${orderId}`)
      await capturePaymentWorkflow(container).run({
        input: { payment_id: payment.id },
      })
    } else {
      logger.info(`Payment already captured for order ${orderId}`)
    }
  } catch (error) {
    logger.error(`Failed to capture payment for order ${orderId}: ${error.message}`)
    return
  }

  try {
    await createOrderFulfillmentWorkflow(container).run({
      input: {
        order_id: orderId,
        items: digitalItems.map(item => ({
          id: item?.id,
          quantity: item?.quantity,
        })),
        no_notification: true,
        requires_shipping: false,
      },
    })

    await completeOrderWorkflow(container).run({
      input: { orderIds: [orderId] },
    })

    logger.info(`Digital fulfilment complete for order ${orderId}`)
  } catch (error) {
    logger.error(`Failed to fulfil digital items for order ${orderId}: ${error.message}`)
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed',
}
