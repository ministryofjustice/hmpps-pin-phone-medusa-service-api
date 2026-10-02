import { Modules, ContainerRegistrationKeys, ModuleRegistrationName } from '@medusajs/framework/utils'

import { createCartWorkflow } from '@medusajs/medusa/core-flows'
import { POST } from '../route'
import { PRISONER_MODULE } from '../../../../../modules/prisoner-details'

// Mock workflow
jest.mock('@medusajs/medusa/core-flows', () => ({
  createCartWorkflow: jest.fn(),
}))

describe('POST /internal/carts/create-cart', () => {
  let req: any
  let res: any
  let container: any
  let prisonerService: any
  let customerService: any
  let linkService: any
  let queryService: any
  let regionService: any
  let salesChannelService: any

  beforeEach(() => {
    // Mock services
    prisonerService = {
      listPrisoners: jest.fn(),
      createPrisoners: jest.fn(),
    }

    customerService = {
      createCustomers: jest.fn(),
    }

    linkService = {
      create: jest.fn(),
    }

    queryService = {
      graph: jest.fn(),
    }

    regionService = {
      listRegions: jest.fn().mockResolvedValue([{ id: 'region_uk' }]),
    }

    salesChannelService = {
      listSalesChannels: jest.fn().mockResolvedValue([{ id: 'Pin Phone Credit Sales Channel' }]),
    }

    // Mock workflow instance
    const workflowInstance = {
      run: jest.fn().mockResolvedValue({
        result: { id: 'cart_123' },
      }),
    }

    ;(createCartWorkflow as unknown as jest.Mock).mockReturnValue(workflowInstance)

    // Mock container.resolve
    container = {
      resolve: jest.fn(key => {
        switch (key) {
          case PRISONER_MODULE:
            return prisonerService
          case Modules.CUSTOMER:
            return customerService
          case ContainerRegistrationKeys.LINK:
            return linkService
          case ContainerRegistrationKeys.QUERY:
            return queryService
          case ModuleRegistrationName.REGION:
            return regionService
          case ModuleRegistrationName.SALES_CHANNEL:
            return salesChannelService
          default:
            throw new Error(`Unknown dependency: ${key}`)
        }
      }),
    }

    // Mock request
    req = {
      body: {
        metadata: {
          prison_id: 'ASI123',
          offender_no: 'STU999',
          first_name: 'John',
          second_name: 'Doe',
        },
      },
      scope: container,
    }

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }
  })

  it('returns existing customer cart when prisoner exists', async () => {
    prisonerService.listPrisoners.mockResolvedValue([{ id: 'ASI123' }])

    queryService.graph.mockResolvedValue({
      data: [
        {
          customer: { id: 'cust_1' },
        },
      ],
    })

    await POST(req, res)

    expect(prisonerService.listPrisoners).toHaveBeenCalledWith({
      prison_id: 'ASI123',
      prisoner_id: 'STU999',
    })

    expect(queryService.graph).toHaveBeenCalled()

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      cart: { id: 'cart_123' },
    })
  })

  it('creates new prisoner, customer, link, and cart when prisoner does not exist', async () => {
    prisonerService.listPrisoners.mockResolvedValue([undefined])

    customerService.createCustomers.mockResolvedValue({
      id: 'cust_new',
    })

    prisonerService.createPrisoners.mockResolvedValue({
      id: 'prisoner_new',
    })

    await POST(req, res)

    expect(customerService.createCustomers).toHaveBeenCalledWith({
      first_name: 'John',
      last_name: 'Doe',
      metadata: {
        prison_id: 'ASI123',
        offender_no: 'STU999',
      },
      has_account: false,
    })

    expect(prisonerService.createPrisoners).toHaveBeenCalledWith({
      prison_id: 'ASI123',
      prisoner_id: 'STU999',
      prisoner_first_name: 'John',
      prisoner_second_name: 'Doe',
    })

    expect(linkService.create).toHaveBeenCalledWith({
      [Modules.CUSTOMER]: { customer_id: 'cust_new' },
      prisoner: { prisoner_id: 'prisoner_new' },
    })

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      cart: { id: 'cart_123' },
    })
  })
})
