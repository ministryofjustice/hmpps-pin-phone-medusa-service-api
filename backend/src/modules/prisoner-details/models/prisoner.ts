import { model } from '@medusajs/framework/utils'

const Prisoner = model.define('prisoner', {
  id: model.id().primaryKey(),
  prison_id: model.text(),
  prisoner_id: model.text(),
})

export default Prisoner
