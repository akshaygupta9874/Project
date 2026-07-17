import { Schema, model, Model } from "mongoose";

import {
  IPayment,
} from "../types/payment.models.js";

import {
  PaymentGateway,
  PaymentMethod,
  PaymentStatus,
} from "../types/payment.types.js";

import { CURRENCY } from "../constants/payment.constants.js";

// ============================================================================
// Fare Breakdown
// ============================================================================

const FareBreakdownSchema = new Schema(
  {
    baseFarePaise: {
      type: Number,
      required: true,
      min: 0,
    },

    distanceFarePaise: {
      type: Number,
      required: true,
      min: 0,
    },

    timeFarePaise: {
      type: Number,
      required: true,
      min: 0,
    },

    surgePaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    platformCommissionPaise: {
      type: Number,
      required: true,
      min: 0,
    },

    driverEarningPaise: {
      type: Number,
      required: true,
      min: 0,
    },

    totalPaise: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  }
);

// ============================================================================
// Payment
// ============================================================================

const PaymentSchema = new Schema<IPayment>(
  {
    ride: {
      type: Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
      index: true,
    },

    rider: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    driver: {
      type: Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
      index: true,
    },

    gateway: {
      type: String,
      enum: Object.values(PaymentGateway),
      default: PaymentGateway.RAZORPAY,
      required: true,
    },

    // CHANGED: Added index because webhook processing frequently queries by gatewayOrderId.
    gatewayOrderId: {
      type: String,
      required: true,
      index: true,
    },

    // CHANGED: Added index because webhook verification frequently queries by gatewayPaymentId.
    gatewayPaymentId: {
      type: String,
    },

    amountPaise: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      required: true,
      default: CURRENCY.INR,
    },

    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.CREATED,
      required: true,
      index: true,
    },

    method: {
      type: String,
      enum: Object.values(PaymentMethod),
    },

    fareBreakdown: {
      type: FareBreakdownSchema,
      required: true,
    },

    /**
     * Makes createOrder idempotent.
     * Retrying the same request with the same key
     * will never create duplicate gateway orders.
     */
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
    },

    /**
     * ADDED: Number of payment attempts for this ride.
     * Starts from 1 and increments for every new gateway order.
     */
    attemptNumber: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },

    failureReason: {
      type: String,
      trim: true, // ADDED: Removes accidental leading/trailing spaces.
    },

    failureCode: {
      type: String,
      trim: true, // ADDED: Removes accidental leading/trailing spaces.
    },

    refundedAmountPaise: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
    },

    // ADDED: Stores the ledger transaction created when payment is captured.
    ledgerTransactionId: {
      type: String,
    },

    // CHANGED: Using a function creates a fresh object for every document.
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },

    capturedAt: {
      type: Date,
    },

    refundedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// ============================================================================
// Indexes
// ============================================================================


// Payment id becomes available only after checkout
PaymentSchema.index(
  {
    gatewayPaymentId: 1,
  },
  {
    unique: true,
    sparse: true,
  }
);

// Find latest payment attempt of a ride
PaymentSchema.index({
  ride: 1,
  createdAt: -1,
});

// Payment history
PaymentSchema.index({
  rider: 1,
  createdAt: -1,
});

// ADDED: Driver payment history.
PaymentSchema.index({
  driver: 1,
  createdAt: -1,
});

// Admin dashboards
PaymentSchema.index({
  status: 1,
  createdAt: -1,
});

// ============================================================================

export const PaymentModel: Model<IPayment> = model<IPayment>(
  "Payment",
  PaymentSchema
);