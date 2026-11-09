import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { GET } from '../route'

describe('GET handler - /internal/pin-phone/subject-access-request', () => {
    let req: any
    let res: any
    let queryService: any
    let container: any

    const mockPaymentSession = (overrides = {}) => ({
        id: 'payses_01',
        amount: 5,
        raw_amount: { value: 0.01, precision: 20 },
        status: 'authorized',
        authorized_at: '2026-10-14T18:00:00Z',
        created_at: '2026-10-14T17:55:00Z',
        updated_at: '2026-10-14T18:00:00Z',
        data: {
            prisonId: 'CKI',
            offenderNo: 'G3682UE',
            amountPence: 500,
            paymentStatus: 'AUTHORIZED',
            financeTransactionReference: 'TXN-2026-00001',
            financeHoldNumber: 12345,
            btCreditLimitPence: 50000,
            btPreBalancePence: 1000,
            btNewBalancePence: 1500,
            errorCode: null,
            errorMessage: null,
        },
        ...overrides,
    })

    const mockFailedPaymentSession = () =>
        mockPaymentSession({
            id: 'payses_02',
            status: 'error',
            authorized_at: null,
            data: {
                prisonId: 'CKI',
                offenderNo: 'G3682UE',
                amountPence: 500,
                paymentStatus: 'ERROR',
                financeTransactionReference: null,
                financeHoldNumber: 123456,
                btCreditLimitPence: null,
                btPreBalancePence: null,
                btNewBalancePence: null,
                errorCode: 'BT_PAYMENT_FAILED',
                errorMessage: 'Unable to parse error response from server.',
            },
        })

    beforeEach(() => {
        jest.clearAllMocks()

        queryService = { graph: jest.fn() }
        container = {
            resolve: jest.fn(key => {
                switch (key) {
                    case ContainerRegistrationKeys.QUERY:
                        return queryService
                    default:
                        throw new Error(`Unknown dependency: ${key}`)
                }
            }),
        }

        req = {
            query: {
                prisonerId: 'G3682UE',
                fromDate: undefined,
                toDate: undefined,
            },
            scope: container,
        }
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        }
    })

    it('returns no information held when prisoner has no customer id associated', async () => {
        req.query.fromDate = '2026-01-01'
        req.query.toDate = '2026-12-31'
        queryService.graph.mockResolvedValueOnce({ data: [] })
        await GET(req, res)

        expect(queryService.graph).toHaveBeenCalledWith({
            entity: 'customer',
            fields: ['id'],
            filters: { prisoner: { prisoner_id: 'G3682UE' } },
        })
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith({ content: 'no information held' })
    })

    it('returns SAR content when prisoner has successful payment', async () => {
        req.query.fromDate = '2026-01-01'
        req.query.toDate = '2026-12-31'
        queryService.graph
            .mockResolvedValueOnce({ data: [{ id: 'cust123' }] })
            .mockResolvedValueOnce({
                data: [
                    {
                        id: 'cart123',
                        completed_at: '2026-10-14T18:00:00Z',
                        created_at: '2026-10-14T17:55:00Z',
                        updated_at: '2026-10-14T18:00:00Z',
                        payment_collection: {
                            payment_sessions: [mockPaymentSession()],
                        },
                    },
                ],
            })

        await GET(req, res)
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith({
            sarContent: [
                expect.objectContaining({
                    prisonCode: 'CKI',
                    orderStatus: 'completed',
                    paymentOutcome: 'AUTHORIZED',
                    amountInPence: '500',
                    btBalanceBeforeTransaction: '1000',
                    btBalanceAfterTransaction: '1500',
                    errorCode: null,
                    errorDescription: null,
                }),
            ],
        })
    })

    it('returns SAR content when prisoner has failed payment', async () => {
        req.query.fromDate = '2026-01-01'
        req.query.toDate = '2026-12-31'
        queryService.graph
            .mockResolvedValueOnce({ data: [{ id: 'cust123' }] })
            .mockResolvedValueOnce({
                data: [
                    {
                        id: 'cart123',
                        completed_at: null,
                        created_at: '2026-10-14T17:50:00Z',
                        updated_at: '2026-10-14T17:50:00Z',
                        payment_collection: {
                            payment_sessions: [mockFailedPaymentSession()],
                        },
                    },
                ],
            })
        await GET(req, res)

        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith({
            sarContent: [
                expect.objectContaining({
                    prisonCode: 'CKI',
                    orderStatus: 'failed',
                    paymentOutcome: 'ERROR',
                    errorCode: 'BT_PAYMENT_FAILED',
                    errorDescription: 'Unable to parse error response from server.',
                }),
            ],
        })
    })

    it('returns both when prisoner has both successful and unsuccesful payments', async () => {
        req.query.fromDate = '2026-01-01'
        req.query.toDate = '2026-12-31'
        queryService.graph
            .mockResolvedValueOnce({ data: [{ id: 'cust123' }] })
            .mockResolvedValueOnce({
                data: [
                    {
                        id: 'cart123',
                        completed_at: '2026-10-14T18:00:00Z',
                        created_at: '2026-10-14T17:55:00Z',
                        updated_at: '2026-10-14T18:00:00Z',
                        payment_collection: {
                            payment_sessions: [mockPaymentSession()],
                        },
                    },
                    {
                        id: 'cart123',
                        completed_at: null,
                        created_at: '2026-10-14T17:50:00Z',
                        updated_at: '2026-10-14T17:50:00Z',
                        payment_collection: {
                            payment_sessions: [mockFailedPaymentSession()],
                        },
                    },
                ],
            })

        await GET(req, res)

        const { sarContent } = res.json.mock.calls[0][0]
        expect(sarContent).toHaveLength(2)
        expect(sarContent[0].orderStatus).toBe('completed')
        expect(sarContent[1].orderStatus).toBe('failed')
    })

    it('returns 500 on unexpected error', async () => {
        queryService.graph.mockRejectedValueOnce(new Error('DB connection failed'))

        await GET(req, res)

        expect(res.status).toHaveBeenCalledWith(500)
        expect(res.json).toHaveBeenCalledWith({
            status: 500,
            errorCode: 'SAR_REQUEST_FAILED',
            userMessage: 'Failed to generate SAR information.',
            developerMessage: 'SAR request failed: DB connection failed',
        })
    })
})