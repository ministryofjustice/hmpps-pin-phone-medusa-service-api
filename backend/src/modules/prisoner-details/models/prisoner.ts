import { model } from '@medusajs/framework/utils'

const Prisoner = model.define('prisoner', {
  id: model.id().primaryKey(),
  prison_id: model.text(),
  prisoner_id: model.text(),
  prisoner_first_name: model.text().nullable(),
  prisoner_second_name: model.text().nullable(),
})

export default Prisoner
