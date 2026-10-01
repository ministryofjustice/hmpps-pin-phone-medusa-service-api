import { AbstractPaymentProvider, PaymentSessionStatus } from '@medusajs/framework/utils'
import type {
  Logger,
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentOutput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  RefundPaymentOutput,
  RetrievePaymentOutput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from '@medusajs/framework/types'
import { randomUUID } from 'node:crypto'
import { PaymentRequest } from '../../api/internal/pin-phone/carts/[id]/complete/route'

type InjectedDependencies = {
  logger: Logger
}

/**
 * Payment provider for BT PIN phone credit purchases.
 *
 * Payment orchestration  happens on the API side.
 * This provider receives the outcome status and stores in medusa DB so it can be queried
 */
class BtPaymentProviderService extends AbstractPaymentProvider {
  static identifier = 'bt-payment'

  protected logger: Logger

  constructor(container: InjectedDependencies, options: Record<string, unknown>) {
    super(container, options)
    this.logger = container.logger
  }

  /**
   * Called when a payment session is created, createPaymentSession.
   * Sets session status based on payment outcome —
   * ERROR for failed/unauthorised
   * PENDING for authorised
   */
  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const data = input.data as PaymentRequest | undefined

    if (!data?.offenderNo) {
      throw new Error('Missing required offenderNo')
    }

    const sessionStatus =
      data.paymentStatus === 'AUTHORIZED' ? PaymentSessionStatus.PENDING : PaymentSessionStatus.ERROR

    this.logger.info(`Initiating payment for prisoner ${data.offenderNo}, status ${data.paymentStatus}`)

    return {
      id: `bt_${randomUUID()}`,
      status: sessionStatus,
      data: { ...data },
    }
  }

  /**
   * Called during completeCartWorkflow for AUTHORIZED payments.
   */
  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const data = input.data as PaymentRequest | undefined

    if (data?.paymentStatus !== 'AUTHORIZED') {
      this.logger.error(`Payment failed for prisoner ${data?.offenderNo}: ${data?.errorMessage}`)
      return {
        status: PaymentSessionStatus.ERROR,
        data: {
          ...data,
        },
      }
    }

    this.logger.info(`Payment authorised for prisoner ${data.offenderNo}, ref: ${data.financeTransactionReference}`)

    return {
      status: PaymentSessionStatus.AUTHORIZED,
      data: { ...data },
    }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const data = input.data as PaymentRequest | undefined

    this.logger.info(`Capturing payment for offender ${data?.offenderNo}`)

    return {
      data: {
        ...data,
        captured_at: new Date().toISOString(),
      },
    }
  }

  // Unimplemented (required by AbstractPaymentProvider)
  async cancelPayment(): Promise<CancelPaymentOutput> {
    throw new Error('cancelPayment not implemented')
  }

  async deletePayment(): Promise<DeletePaymentOutput> {
    throw new Error('deletePayment not implemented')
  }

  async updatePayment(): Promise<UpdatePaymentOutput> {
    throw new Error('updatePayment not implemented')
  }

  async getPaymentStatus(): Promise<GetPaymentStatusOutput> {
    throw new Error('getPaymentStatus not implemented')
  }

  async retrievePayment(): Promise<RetrievePaymentOutput> {
    throw new Error('retrievePayment not implemented')
  }

  async refundPayment(): Promise<RefundPaymentOutput> {
    throw new Error('refundPayment not implemented')
  }

  async getWebhookActionAndData(): Promise<WebhookActionResult> {
    throw new Error('getWebhookActionAndData not implemented')
  }
}

export default BtPaymentProviderService
