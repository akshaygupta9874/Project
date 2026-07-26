import { paymentRepository } from "../repositories/payment.repository.js";
import { ledgerRepository } from "../repositories/ledger.repository.js";
import { PaymentStatus, LedgerReferenceType } from "../types/payment.types.js";

export class ReconciliationService {
  async reconcilePayment(paymentId: string) {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.status !== PaymentStatus.CAPTURED) {
      return { status: payment.status };
    }

    const ledgerEntries = await ledgerRepository.listByReference(
      LedgerReferenceType.PAYMENT,
      payment._id
    );

    return {
      paymentId,
      ledgerEntryCount: ledgerEntries.length,
      status: payment.status,
      ledgerTransactionId: payment.ledgerTransactionId,
    };
  }
}

export const reconciliationService = new ReconciliationService();
