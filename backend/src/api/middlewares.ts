import { defineMiddlewares } from '@medusajs/framework/http'
import { validateHmppsToken } from './middlewares/validateHmppsToken'

export default defineMiddlewares({
  routes: [{ matcher: '/internal/*', middlewares: [validateHmppsToken] }],
})
