import { Module } from '@medusajs/framework/utils'
import PrisonerModuleService from './service'

export const PRISONER_MODULE = 'prisoner'

export default Module(PRISONER_MODULE, {
  service: PrisonerModuleService,
})
