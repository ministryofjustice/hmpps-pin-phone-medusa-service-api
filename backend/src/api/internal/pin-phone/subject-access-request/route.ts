import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * @openapi
 * /internal/pin-phone/subject-access-request:
 *   get:
 *     operationId: SarAccessRequest
 *     summary: Get SAR report information for a given prisoner
 *     description: >
 *       Returns all payment session data associated with the prisoner,
 *       covering both successful and unsuccessful transactions.
 *     parameters:
 *       - in: query
 *         name: prisonerId
 *         required: true
 *         schema:
 *           type: string
 *         description: The prisoner's offender number
 *         example: G3682UE
 *       - in: query
 *         name: fromDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: The start date of the SAR request
 *         example: '2026-01-01'
 *       - in: query
 *         name: toDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: End start date of the SAR request
 *         example: '2026-12-31'
 *     responses:
 *       200:
 *         description: SAR data returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SarRequestResponse'
 *       500:
 *         description: Failed to generate SAR information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const GET = async (req, res) => {
    try {
        const { prisonerId, fromDate, toDate } = req.query
        const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

        // find customer ID associated with Prisoner
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

        // Query to find carts associated with prisoner with given date period
        const { data: carts } = await query.graph({
            entity: 'cart',
            fields: [
                'id',
                'completed_at',
                'created_at',
                'updated_at',
                'payment_collection.payment_sessions.*',
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

        const sarContent = carts.flatMap((cart) => {
            const sessions = cart.payment_collection?.payment_sessions ?? []

            return sessions.map((session) => {
                const data = (session.data ?? {}) as Record<string, any>
                return {
                    prisonCode: data.prisonId ?? '',
                    orderStatus: data.paymentStatus == 'AUTHORIZED' ? 'completed' : 'failed',
                    orderCreatedAt: cart.created_at,
                    orderUpdatedAt: cart.updated_at,
                    amountInPounds: String(session.amount ?? ''),
                    rawAmount: session.raw_amount ? `value : ${session.raw_amount.value}, precision : ${session.raw_amount.precision}` : '',
                    paymentStatus: data.paymentStatus ?? '',
                    paymentAuthorizedAt: session.authorized_at ?? '',
                    paymentCreatedAt: session.created_at ?? '',
                    paymentUpdatedAt: session.updated_at ?? '',
                    amountInPence: String(data.amountPence ?? ''),
                    paymentOutcome: data.paymentStatus ?? '',
                    btCreditLimit: String(data.btCreditLimitPence ?? ''),
                    btBalanceBeforeTransaction: String(data.btPreBalancePence ?? ''),
                    btBalanceAfterTransaction: String(data.btNewBalancePence ?? ''),
                    errorCode: data.errorCode ?? null,
                    errorDescription: data.errorMessage ?? null,
                }
            })
        })
        return res.status(200).json({ sarContent })
    }
    catch (error) {
        return res.status(500).json({
        status: 500,
        errorCode: 'SAR_REQUEST_FAILED',
        userMessage: 'Failed to generate SAR information.',
        developerMessage: `SAR request failed: ${(error as Error).message}`,
    })
    }
}