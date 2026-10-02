import { MedusaService } from '@medusajs/framework/utils'
import Prisoner from './models/prisoner'

class PrisonerModuleService extends MedusaService({
  Prisoner,
}) {}

export default PrisonerModuleService
