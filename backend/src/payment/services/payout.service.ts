import { Types } from "mongoose";

import { AppError } from "../../utils/AppError.js";
import { PayoutModel } from "../models/payout.model.js";
import { PayoutStatus, PayoutMode } from "../types/payment.types.js";

export class PayoutService {
  async createPayout(input: {
    driverId: Types.ObjectId;
    paymentId: Types.ObjectId;
    rideId: Types.ObjectId;
    amountPaise: number;
    mode?: PayoutMode;
    metadata?: Record<string, unknown>;
  }) {
    const payout = await PayoutModel.create({
      driver: input.driverId,
      payment: input.paymentId,
      ride: input.rideId,
      amountPaise: input.amountPaise,
      status: PayoutStatus.PENDING,
      mode: input.mode ?? PayoutMode.IMPS,
      metadata: input.metadata ?? {},
    });

    return payout;
  }

  async markProcessed(payoutId: string, gatewayPayoutId?: string) {
    const payout = await PayoutModel.findByIdAndUpdate(
      payoutId,
      {
        $set: {
          status: PayoutStatus.PROCESSED,
          gatewayPayoutId,
          processedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!payout) {
      throw new AppError("Payout not found.", 404, "PAYOUT_NOT_FOUND");
    }

    return payout;
  }

  async markFailed(payoutId: string, reason?: string) {
    const payout = await PayoutModel.findByIdAndUpdate(
      payoutId,
      {
        $set: {
          status: PayoutStatus.FAILED,
          failureReason: reason ?? "Unknown payout failure",
          failedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!payout) {
      throw new AppError("Payout not found.", 404, "PAYOUT_NOT_FOUND");
    }

    return payout;
  }
}

export const payoutService = new PayoutService();
