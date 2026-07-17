import { Schema, model, Model, Query } from "mongoose";

import { ILedgerEntry } from "../types/payment.models.js";

import {
    LedgerAccount,
    LedgerEntryType,
    LedgerReferenceType,
} from "../types/payment.types.js";

import { CURRENCY } from "../constants/payment.constants.js";

const LedgerEntrySchema = new Schema<ILedgerEntry>(
    {
        transactionId: {
            type: String,
            required: true,

        },

        account: {
            type: String,
            enum: Object.values(LedgerAccount),
            required: true,
            index: true, // ADDED: Frequently queried while calculating balances.
        },

        entryType: {
            type: String,
            enum: Object.values(LedgerEntryType),
            required: true,
        },

        amountPaise: {
            type: Number,
            required: true,
            validate: {
                validator: (v: number) =>
                    Number.isInteger(v) && v > 0,
                message:
                    "amountPaise must be a positive integer",
            },
        },

        currency: {
            type: String,
            required: true,
            default: CURRENCY.INR,
        },

        referenceType: {
            type: String,
            enum: Object.values(LedgerReferenceType),
            required: true,
            index: true, // ADDED: Speeds up payment/refund/payout lookups.
        },

        referenceId: {
            type: Schema.Types.ObjectId, // CHANGED: Better than String since all references are Mongo ObjectIds.
            required: true,
            index: true, // ADDED: Used together with referenceType.
        },

        description: {
            type: String,
            required: true,
            trim: true, // ADDED: Prevent accidental leading/trailing spaces.
        },

        metadata: {
            type: Schema.Types.Mixed,
            default: {},
        },
    },
    {
        // Append-only ledger: no updatedAt, because ledger rows are never updated.
        timestamps: {
            createdAt: true,
            updatedAt: false,
        },
    }
);

LedgerEntrySchema.index({
    transactionId: 1,
}); // ADDED: Fetch all entries belonging to one accounting transaction.

LedgerEntrySchema.index({
    account: 1,
    createdAt: 1,
});

LedgerEntrySchema.index({
    referenceType: 1,
    referenceId: 1,
});

// ─────────────────────────────────────────────────────────────────────────
// Immutability guard. Application code should never call update/delete on
// this collection — the ledger is corrected by posting a reversing entry,
// never by mutating history. This hook is defense-in-depth against a future
// contributor (or a bug) reaching for findOneAndUpdate out of habit.
// ─────────────────────────────────────────────────────────────────────────

function rejectMutation(
    this: Query<unknown, ILedgerEntry>
): void {
    throw new Error(
        "LedgerEntry is append-only: mutation and deletion are not permitted"
    );
}

LedgerEntrySchema.pre(
    "findOneAndUpdate",
    rejectMutation
);

LedgerEntrySchema.pre(
    "updateOne",
    rejectMutation
);

LedgerEntrySchema.pre(
    "updateMany",
    rejectMutation
);

LedgerEntrySchema.pre(
    "findOneAndDelete",
    rejectMutation
);

LedgerEntrySchema.pre(
    "deleteOne",
    rejectMutation
);

LedgerEntrySchema.pre(
    "deleteMany",
    rejectMutation
);

export const LedgerEntryModel: Model<ILedgerEntry> =
    model<ILedgerEntry>(
        "LedgerEntry",
        LedgerEntrySchema
    );