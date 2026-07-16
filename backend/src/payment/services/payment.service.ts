import { randomUUID, createHmac, timingSafeEqual } from "crypto";
import mongoose from "mongoose";

import {
  RazorpayPaymentEntity,
} from "../types/razorpay.types.js";

import {
  InitiateRefundInput,
} from "../types/payment.dto.js";

import {
  LedgerAccount,
  LedgerEntryType,
  LedgerReferenceType
} from "../types/payment.types.js";

import {
  REFUND_LOCK_TTL_MS,
} from "../constants/payment.constants.js";

import { razorpayClient } from "../../config/razorpay.config.js";
import { redisClient } from "../../redis/client.js";

import { AppError } from "../../utils/AppError.js";

import { paymentRepository } from "../repositories/payment.repository.js";
import { ledgerService } from "./ledger.service.js";

import {
  CreateOrderInput,
  CreateOrderResult,
  VerifyCheckoutInput,
} from "../types/payment.dto.js";

import {
  IFareBreakdown,
  CurrencyType,
  PaymentGateway,
  PaymentMethod,
  PaymentStatus,
} from "../types/payment.types.js";

import {
  CURRENCY,
  IDEMPOTENCY_LOCK_TTL_MS,
  MAX_PAYMENT_AMOUNT_PAISE,
  MIN_PAYMENT_AMOUNT_PAISE,
  REDIS_KEYS,
} from "../constants/payment.constants.js";

const RAZORPAY_METHOD_MAP: Record<
  string,
  PaymentMethod
> = {
  upi: PaymentMethod.UPI,

  card: PaymentMethod.CARD,

  netbanking: PaymentMethod.NETBANKING,

  wallet: PaymentMethod.WALLET,

  emi: PaymentMethod.EMI,
};

/**
 * Thin wrapper around a Redis SET NX PX lock.
 * Returns a release function, or null if lock acquisition fails.
 */
async function acquireLock(
  key: string,
  ttlMs: number
): Promise<(() => Promise<void>) | null> {

  const token = randomUUID();

  const result =
    await redisClient.set(
      key,
      token,
      {
        NX: true,
        PX: ttlMs,
      }
    );

  if (result !== "OK") {
    return null;
  }

  return async () => {

    try {

      const current =
        await redisClient.get(key);

      if (current === token) {
        await redisClient.del(key);
      }

    } catch {

      // Logger removed for now.

    }

  };

}

function validateFareBreakdown(
  fare: IFareBreakdown
): void {

  const fareTotal =
    fare.baseFarePaise +
    fare.distanceFarePaise +
    fare.timeFarePaise +
    fare.surgePaise;

  const earningTotal =
    fare.driverEarningPaise +
    fare.platformCommissionPaise;

  if (
    fareTotal !==
    fare.totalPaise
  ) {

    throw new AppError(
      `Fare components (${fareTotal}) do not equal total (${fare.totalPaise})`,
      422,
      "FARE_BREAKDOWN_INVALID"
    );

  }

  if (
    earningTotal !==
    fare.totalPaise
  ) {

    throw new AppError(
      `Driver + Platform split (${earningTotal}) does not equal total (${fare.totalPaise})`,
      422,
      "FARE_BREAKDOWN_INVALID"
    );

  }

  if (
    fare.totalPaise <
    MIN_PAYMENT_AMOUNT_PAISE ||
    fare.totalPaise >
    MAX_PAYMENT_AMOUNT_PAISE
  ) {

    throw new AppError(
      `Payment amount ${fare.totalPaise} is outside the allowed range.`,
      422,
      "PAYMENT_AMOUNT_OUT_OF_RANGE"
    );

  }

}

class PaymentService {
  /**
   * Creates a Razorpay order for a ride.
   *
   * Idempotent using idempotencyKey.
   */
  async createOrder(
    input: CreateOrderInput
  ): Promise<CreateOrderResult> {

    validateFareBreakdown(
      input.fareBreakdown
    );

    const existing =
      await paymentRepository.findByIdempotencyKey(
        input.idempotencyKey
      );

    if (existing) {

      return {
        paymentId:
          existing._id.toString(),

        gatewayOrderId:
          existing.gatewayOrderId,

        amountPaise:
          existing.amountPaise,

        currency:
          existing.currency,

        razorpayKeyId:
          process.env
            .RAZORPAY_KEY_ID!,

        status:
          existing.status,
      };

    }

    const release =
      await acquireLock(
        REDIS_KEYS.paymentOrderLock(
          input.ride.toString() // CHANGED: rideId -> ride
        ),
        IDEMPOTENCY_LOCK_TTL_MS
      );

    if (!release) {

      throw new AppError(
        "Payment order is already being created.",
        409,
        "PAYMENT_ORDER_IN_PROGRESS"
      );

    }

    try {

      // Re-check after lock acquisition.
      const raced =
        await paymentRepository.findByIdempotencyKey(
          input.idempotencyKey
        );

      if (raced) {

        return {
          paymentId:
            raced._id.toString(),

          gatewayOrderId:
            raced.gatewayOrderId,

          amountPaise:
            raced.amountPaise,

          currency:
            raced.currency,

          razorpayKeyId:
            process.env
              .RAZORPAY_KEY_ID!,

          status:
            raced.status,
        };

      }

      const order =
        await razorpayClient.orders.create(
          {
            amount:
              input
                .fareBreakdown
                .totalPaise,

            currency:
              CURRENCY.INR,

            receipt:
              input.ride.toString(),

            // CHANGED: Razorpay captures automatically.
            payment_capture: true,

            notes: {
              ride:
                input.ride.toString(),

              rider:
                input.rider.toString(),

              driver:
                input.driver.toString(),
            },
          }
        );

      const payment =
        await paymentRepository.create(
          {
            ride:
              input.ride,

            rider:
              input.rider,

            driver:
              input.driver,

            gateway:
              PaymentGateway.RAZORPAY,

            gatewayOrderId:
              order.id,

            amountPaise:
              input
                .fareBreakdown
                .totalPaise,

            currency:
              CURRENCY.INR as CurrencyType,

            status:
              PaymentStatus.CREATED,

            fareBreakdown:
              input.fareBreakdown,

            idempotencyKey:
              input.idempotencyKey,

            // CHANGED: attempts -> attemptNumber
            attemptNumber: 1,

            refundedAmountPaise: 0,

            metadata: {},
          }
        );

      return {

        paymentId:
          payment._id.toString(),

        gatewayOrderId:
          order.id,

        amountPaise:
          payment.amountPaise,

        currency:
          payment.currency,

        razorpayKeyId:
          process.env
            .RAZORPAY_KEY_ID!,

        status:
          payment.status,

      };

    } finally {

      await release();

    }

  }
  /**
 * Verifies the Checkout signature returned by Razorpay.
 *
 * NOTE:
 * This only verifies that the checkout callback is genuine.
 * The payment is considered final only after the
 * payment.captured webhook.
 */
  async verifyCheckoutSignature(
    input: VerifyCheckoutInput
  ): Promise<PaymentStatus> {

    const secret =
      process.env
        .RAZORPAY_KEY_SECRET!;

    const expectedSignature =
      createHmac(
        "sha256",
        secret
      )
        .update(
          `${input.gatewayOrderId}|${input.gatewayPaymentId}`
        )
        .digest("hex");

    const expectedBuffer =
      Buffer.from(
        expectedSignature,
        "hex"
      );

    const actualBuffer =
      Buffer.from(
        input.signature,
        "hex"
      );

    const valid =
      expectedBuffer.length ===
      actualBuffer.length &&
      timingSafeEqual(
        expectedBuffer,
        actualBuffer
      );

    if (!valid) {

      throw new AppError(
        "Invalid Razorpay signature.",
        400,
        "PAYMENT_SIGNATURE_INVALID"
      );

    }

    const payment =
      await paymentRepository.findByGatewayOrderId(
        input.gatewayOrderId
      );

    if (!payment) {

      throw new AppError(
        "Payment not found.",
        404,
        "PAYMENT_NOT_FOUND"
      );

    }

    const updated =
      await paymentRepository.transitionStatus(
        payment._id.toString(),

        PaymentStatus.CREATED,

        {
          status:
            PaymentStatus.PENDING,

          gatewayPaymentId:
            input.gatewayPaymentId,
        }
      );

    // CHANGED:
    // If transition fails it usually means the webhook
    // has already updated the payment. Returning the
    // current status makes this endpoint idempotent.

    return (
      updated?.status ??
      payment.status
    );

  }
  /**
   * Handles the payment.captured webhook.
   *
   * This is the source of truth for successful payments.
   * Ledger entries are posted only from here.
   */
  async handlePaymentCaptured(
    entity: RazorpayPaymentEntity
  ): Promise<void> {

    const payment =
      await paymentRepository.findByGatewayOrderId(
        entity.order_id
      );

    if (!payment) {

      throw new AppError(
        "Payment not found.",
        404,
        "PAYMENT_NOT_FOUND"
      );

    }

    // Already processed.
    if (
      payment.status ===
      PaymentStatus.CAPTURED
    ) {
      return;
    }

    if (
      payment.amountPaise !==
      entity.amount
    ) {

      throw new AppError(
        "Captured amount mismatch.",
        409,
        "PAYMENT_AMOUNT_MISMATCH"
      );

    }

    const session =
      await mongoose.startSession();

    try {

      await session.withTransaction(
        async () => {

          // CHANGED:
          // Simplified ledger accounts.
          // Removed GST posting.

          const transactionId = await ledgerService.recordTransaction(
            {
              entries: [
                {
                  account:
                    LedgerAccount.RIDER,

                  entryType:
                    LedgerEntryType.DEBIT,

                  amountPaise:
                    payment.amountPaise,

                  description:
                    `Payment received for ride ${payment.ride.toString()}`,
                },

                {
                  account:
                    LedgerAccount.PLATFORM,

                  entryType:
                    LedgerEntryType.CREDIT,

                  amountPaise:
                    payment.fareBreakdown.platformCommissionPaise,

                  description:
                    `Platform commission`,
                },

                {
                  account:
                    LedgerAccount.DRIVER,

                  entryType:
                    LedgerEntryType.CREDIT,

                  amountPaise:
                    payment.fareBreakdown.driverEarningPaise,

                  description:
                    `Driver earning`,
                },
              ],

              referenceType:
                LedgerReferenceType.PAYMENT,

              // CHANGED:
              // referenceId is now ObjectId.

              referenceId:
                payment._id,
            },
            session
          );

          await paymentRepository.transitionStatus(
            payment._id.toString(),

            payment.status,

            {
              ledgerTransactionId: transactionId,
              status:
                PaymentStatus.CAPTURED,

              gatewayPaymentId:
                entity.id,

              method:
                RAZORPAY_METHOD_MAP[
                entity.method
                ] ??
                PaymentMethod.UNKNOWN,

              capturedAt:
                new Date(
                  entity.created_at *
                  1000
                ),
            },

            session
          );

        }
      );

    } finally {
      await session.endSession();
    }
  }

  async handlePaymentFailed(
    entity: RazorpayPaymentEntity
  ): Promise<void> {

    const payment =
      await paymentRepository.findByGatewayOrderId(
        entity.order_id
      );

    if (!payment) {
      return;
    }

    if (
      payment.status ===
      PaymentStatus.FAILED ||
      payment.status ===
      PaymentStatus.CAPTURED
    ) {
      return;
    }

    await paymentRepository.transitionStatus(
      payment._id.toString(),

      payment.status,

      {
        status:
          PaymentStatus.FAILED,

        failureReason:
          entity.error_description ??
          undefined,

        failureCode:
          entity.error_code ??
          undefined,
      }
    );

    await paymentRepository.incrementAttempts(
      payment._id.toString()
    );
  }

  /**
* Initiates a full or partial refund.
*
* CHANGED:
* Since the simplified payment module no longer stores
* ledgerTransactionId, the refund simply reverses the
* proportional ledger transaction based on the payment.
*/
  async initiateRefund(
    input: InitiateRefundInput
  ): Promise<void> {

    const release =
      await acquireLock(
        REDIS_KEYS.refundLock(
          input.paymentId.toString()
        ),
        REFUND_LOCK_TTL_MS
      );

    if (!release) {

      throw new AppError(
        "Refund already in progress.",
        409,
        "REFUND_IN_PROGRESS"
      );

    }

    try {

      const payment =
        await paymentRepository.findById(
          input.paymentId.toString()
        );

      if (!payment) {

        throw new AppError(
          "Payment not found.",
          404,
          "PAYMENT_NOT_FOUND"
        );

      }

      if (
        payment.status !==
        PaymentStatus.CAPTURED &&
        payment.status !==
        PaymentStatus.PARTIALLY_REFUNDED
      ) {

        throw new AppError(
          `Cannot refund payment in status ${payment.status}`,
          409,
          "PAYMENT_NOT_REFUNDABLE"
        );

      }

      if (!payment.gatewayPaymentId) {

        throw new AppError(
          "Gateway payment id missing.",
          409,
          "PAYMENT_NOT_CAPTURED"
        );

      }

      const remainingAmount =
        payment.amountPaise -
        payment.refundedAmountPaise;

      const refundAmount =
        input.amountPaise ??
        remainingAmount;

      if (
        refundAmount <= 0 ||
        refundAmount >
        remainingAmount
      ) {

        throw new AppError(
          "Invalid refund amount.",
          422,
          "REFUND_AMOUNT_INVALID"
        );

      }

      const refund =
        await razorpayClient.payments.refund(
          payment.gatewayPaymentId,
          {
            amount:
              refundAmount,

            notes: {
              reason:
                input.reason,

              initiatedBy:
                input.initiatedBy.toString(),
            },
          }
        );

      const fraction =
        refundAmount /
        payment.amountPaise;

      const newRefundedAmount =
        payment.refundedAmountPaise +
        refundAmount;

      const newStatus =
        newRefundedAmount >=
          payment.amountPaise
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED;

      const session =
        await mongoose.startSession();

      try {

        await session.withTransaction(
          async () => {

            // CHANGED:
            // Since ledgerTransactionId was removed,
            // transactionId is generated from payment id.
            // Replace this logic later if you introduce
            // dedicated accounting transaction ids.
            if (!payment.ledgerTransactionId) {

              throw new AppError(
                "Ledger transaction not found.",
                500,
                "LEDGER_TRANSACTION_NOT_FOUND"
              );

            }

            await ledgerService.reverseTransactionPartial(
              payment.ledgerTransactionId,
              fraction,
              LedgerReferenceType.REFUND,
              payment._id,
              input.reason,
              session
            );

            await paymentRepository.transitionStatus(
              payment._id.toString(),

              payment.status,

              {
                status:
                  newStatus,

                refundedAmountPaise:
                  newRefundedAmount,

                refundedAt:
                  new Date(),
              },

              session
            );

          }
        );

      } finally {

        await session.endSession();

      }

    } finally {

      await release();

    }

  }

}

export const paymentService =
  new PaymentService();