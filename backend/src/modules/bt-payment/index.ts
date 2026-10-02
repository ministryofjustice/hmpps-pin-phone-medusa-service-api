import { ModuleProvider, Modules } from '@medusajs/framework/utils'
import BtPaymentProviderService from './BtPaymentProviderService'

export default ModuleProvider(Modules.PAYMENT, {
  services: [BtPaymentProviderService],
})
