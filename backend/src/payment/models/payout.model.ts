import { Schema, model, Model } from "mongoose";

import { IPayout } from "../types/payment.models.js";

import {
    PayoutMode,
    PayoutStatus,
} from "../types/payment.types.js";

import {
    CURRENCY,
    DEFAULT_PAYOUT_MODE,
} from "../constants/payment.constants.js";

const PayoutSchema = new Schema<IPayout>(
    {
        driver: {
            type: Schema.Types.ObjectId,
            ref: "Driver",
            required: true,
            index: true,
        },

        // ADDED: Links payout back to the payment that generated it.
        payment: {
            type: Schema.Types.ObjectId,
            ref: "Payment",
            required: true,
            index: true,
        },

        // ADDED: Links payout back to the ride.
        ride: {
            type: Schema.Types.ObjectId,
            ref: "Ride",
            required: true,
            index: true,
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
            enum: Object.values(PayoutStatus),
            required: true,
            default: PayoutStatus.PENDING,
            index: true,
        },

        mode: {
            type: String,
            enum: Object.values(PayoutMode),
            required: true,
            default: DEFAULT_PAYOUT_MODE,
        },

        gatewayPayoutId: {
            type: String,
            index: true, // ADDED: Frequently searched from webhook.
        },

        processedAt: {
            type: Date,
        },

        failureReason: {
            type: String,
            trim: true, // ADDED: Removes accidental leading/trailing spaces.
        },

        // CHANGED: Fresh object for every document.
        metadata: {
            type: Schema.Types.Mixed,
            default: () => ({}),
        },
    },
    {
        timestamps: true,
    }
);

PayoutSchema.index(
    {
        gatewayPayoutId: 1,
    },
    {
        unique: true,
        sparse: true,
    }
);

PayoutSchema.index({
    driver: 1,
    status: 1,
    createdAt: -1,
});

// ADDED: Useful for finding payout of a payment.
PayoutSchema.index({
    payment: 1,
});

// ADDED: Useful for finding payout of a ride.
PayoutSchema.index({
    ride: 1,
});

export const PayoutModel: Model<IPayout> = model<IPayout>(
    "Payout",
    PayoutSchema
);