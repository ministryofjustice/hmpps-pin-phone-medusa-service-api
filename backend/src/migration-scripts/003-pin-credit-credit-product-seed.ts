import { MedusaContainer } from '@medusajs/framework'
import { ContainerRegistrationKeys, ModuleRegistrationName, ProductStatus } from '@medusajs/framework/utils'
import { createProductsWorkflow } from '@medusajs/medusa/core-flows'

export default async function seedProducts({ container }: { container: MedusaContainer }) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productModuleService = container.resolve(ModuleRegistrationName.PRODUCT)

  const { data: salesChannels } = await query.graph({
    entity: 'sales_channel',
    fields: ['id', 'name'],
    filters: { name: 'Pin Phone Credit Sales Channel' },
  })
  const digitalSalesChannel = salesChannels[0]

  const { data: shippingProfiles } = await query.graph({
    entity: 'shipping_profile',
    fields: ['id', 'name'],
    filters: { name: 'Pin Phone Credit Digital Delivery' },
  })
  const digitalShippingProfile = shippingProfiles[0]

  let [digitalType] = await productModuleService.listProductTypes({ value: 'pin-phone-credit-digital-product' })
  if (!digitalType) {
    ;[digitalType] = await productModuleService.createProductTypes([{ value: 'pin-phone-credit-digital-product' }])
  }

  const [existing] = await productModuleService.listProducts({ handle: 'pin-phone-credit' })
  if (existing) {
    logger.info('Updating Pin phone credit product')
    await productModuleService.updateProducts(existing.id, {
      title: 'Pin Phone Credit',
      description: 'Digital product for Pin Phone Credit',
      status: ProductStatus.PUBLISHED,
      thumbnail: 'https://placehold.co/400x400/1a1a2e/ffffff?text=Pin+Credit',
      images: [
        {
          url: 'https://placehold.co/400x400/1a1a2e/ffffff?text=Pin+Credit',
        },
      ],
    })
    logger.info('Updated Pin Phone Credit.')
    return
  }

  logger.info('Creating Pin Phone Credit')
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: 'Pin Phone Credit',
          description: 'Digital product for Pin Phone Credit',
          handle: 'pin-phone-credit',
          status: ProductStatus.PUBLISHED,
          type_id: digitalType.id,
          shipping_profile_id: digitalShippingProfile.id,
          thumbnail: 'https://placehold.co/400x400/1a1a2e/ffffff?text=Pin+Credit',
          discountable: false,
          is_giftcard: false,
          images: [
            {
              url: 'https://placehold.co/400x400/1a1a2e/ffffff?text=Pin+Credit',
            },
          ],
          options: [
            {
              title: 'Type',
              values: ['Digital'],
            },
          ],
          variants: [
            {
              title: 'Pin Phone Credit',
              sku: 'PIN-PHONE-CREDIT',
              manage_inventory: false,
              prices: [{ amount: 0, currency_code: 'gbp' }],
            },
          ],
          sales_channels: [{ id: digitalSalesChannel.id }],
        },
      ],
    },
  })

  logger.info('Finished seeding Pin Phone Credit.')
}
