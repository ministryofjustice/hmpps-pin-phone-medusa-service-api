// backend/src/api/subject-access-request/route.ts
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const GET = async (req, res) => {
    const { prisonerId, crn, fromDate, toDate } = req.query
    console.log(prisonerId, prisonerId)
    if (!prisonerId) return res.sendStatus(209)

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    const { data: customers } = await query.graph({
        entity: "customer",
        fields: ["id"],
        filters: {
            prisoner: {
                prisoner_id: prisonerId,
            },
        },
    })
    customers.customer_id

    const { data: orders } = await query.graph({
        entity: "order",
        fields: ["id", "display_id", "status", "created_at", "total", "items.id", "payment_collections.id, cart"],
        filters: {
            customer_id: customers.customer_id,
            ...(fromDate || toDate ? { created_at: { $gte: fromDate, $lte: toDate } } : {}),
        },
    })
    const { data: carts } = await query.graph({
        entity: "cart",
        fields: ["id", "display_id", "status", "created_at", "total", "items.id", "completed_at"],
        filters: {
            customer_id: customers.customer_id,
            ...(fromDate || toDate ? { created_at: { $gte: fromDate, $lte: toDate } } : {}),
        },
    })

    res.json({ content: { prisonerNumber: prisonerId, orders, carts } })
}