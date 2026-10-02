import { defineLink } from '@medusajs/framework/utils'
import CustomerModule from '@medusajs/medusa/customer'
import PrisonerModule from '../modules/prisoner-details'

export default defineLink(CustomerModule.linkable.customer, PrisonerModule.linkable.prisoner)
