import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const GET = async (req, res) => {
    const { prisonerId, fromDate, toDate } = req.query

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
    console.log(customers.customer_id)
    if (!customers.length) {
        return res.status(200).json({ content: "no information held" })
    }
    const customerIds = customers.map((c) => c.id)

    const { data: orders } = await query.graph({
        entity: "order",
        fields: [
            'id',
            'status',
            'created_at',
            'updated_at',
            'payment_collections.payment_sessions.*',
        ],
        filters: {
            customer_id: customerIds,
            ...(fromDate || toDate
                ? {
                    created_at: {
                        ...(fromDate ? { $gte: fromDate } : {}),
                        ...(toDate ? { $lte: toDate } : {}),
                    },
                }
                : {}),
        },
    })

// 3. Map to flat SarPinPhone objects
    const content = orders.flatMap((order) => {
        const sessions = order.payment_collections?.flatMap(
            (pc) => pc.payment_sessions ?? []
        ) ?? []

        return sessions.map((session) => {
            const data = (session.data ?? {}) as Record<string, any>
            return {
                prisonCode: data.prisonId ?? '',
                orderStatus: order.status,
                orderCreatedAt: order.created_at,
                orderUpdatedAt: order.updated_at,
                amountInPounds: String(session.amount ?? ''),
                rawAmount: session.raw_amount
                    ? `value : ${session.raw_amount.value} and precision : ${session.raw_amount.precision}`
                    : '',
                paymentStatus: session.status ?? '',
                paymentAuthorizedAt: session.authorized_at ?? '',
                paymentCreatedAt: session.created_at ?? '',
                paymentUpdatedAt: session.updated_at ?? '',
                amountInPence: String(data.amountPence ?? ''),
                paymentOutcome: data.paymentStatus ?? '',
                btCreditLimit: String(data.btCreditLimitPence ?? ''),
                btBalanceBeforeTransaction: String(data.btPreBalancePence ?? ''),
                btBalanceAfterTransaction: String(data.btNewBalancePence ?? ''),
                errorCode: data.errorCode ?? '',
                errorDescription: data.errorMessage ?? '',
            }
        })
    })

    return res.json({ content })
}