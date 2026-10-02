import { MedusaContainer } from '@medusajs/framework'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { createStoresWorkflow, createTaxRegionsWorkflow } from '@medusajs/medusa/core-flows'

/**
 * Initial seed.
 *
 * Only contains entities that are store-wide / shared across every
 * sales channel
 *
 * Future Sales Channels and their configuration will go into separate migration files.
 *
 */
export default async function initial_data_seed({ container }: { container: MedusaContainer }) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const countries = ['gb']

  logger.info('Seeding store wide data')

  // Creates the store, which is the top-level entity in Medusa.
  await createStoresWorkflow(container).run({
    input: {
      stores: [
        {
          name: 'PIN Phone Store',
          supported_currencies: [
            {
              currency_code: 'gbp',
              is_default: true,
            },
          ],
        },
      ],
    },
  })

  // Creates tax regions for each country.
  await createTaxRegionsWorkflow(container).run({
    input: countries.map(country_code => ({
      country_code,
      provider_id: 'tp_system',
    })),
  })

  logger.info('Store wide seed complete')
}
