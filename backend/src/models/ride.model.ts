import { Schema, model, Document, Types, Model } from "mongoose";
import { IFareBreakdown } from "../payment/types/payment.types.js"; // ADDED

export enum RideStatus {
    SEARCHING = "SEARCHING",
    DRIVER_ASSIGNED = "DRIVER_ASSIGNED",
    DRIVER_ARRIVING = "DRIVER_ARRIVING",
    STARTED = "STARTED",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
}

export enum RidePaymentStatus {
    PENDING = "PENDING",

    PAID = "PAID",

    FAILED = "FAILED",

    REFUNDED = "REFUNDED",
}

const FareBreakdownSchema = new Schema(
    {
        baseFarePaise: Number,

        distanceFarePaise: Number,

        timeFarePaise: Number,

        surgePaise: Number,

        platformCommissionPaise: Number,

        driverEarningPaise: Number,

        totalPaise: Number,
    },
    {
        _id: false,
    }
);

export interface IRide extends Document {
    rider: Types.ObjectId;
    driver?: Types.ObjectId | null;
    pickup: { address: string; coordinates: { latitude: number; longitude: number } };
    destination: { address: string; coordinates: { latitude: number; longitude: number } };
    fare: {
        estimated: number;

        final?: number | null;

        breakdown?: IFareBreakdown | null; // ADDED
    };

    distance: { estimated: number; actual?: number | null };
    duration: { estimated: number; actual?: number | null };
    status: RideStatus;
    paymentStatus: RidePaymentStatus;
    cancelledBy?: "RIDER" | "DRIVER" | "SYSTEM" | null;
    cancellationReason?: string | null;
    startedAt?: Date;
    completedAt?: Date;
    cancelledAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const rideSchema = new Schema<IRide>(
    {
        rider: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        driver: { type: Schema.Types.ObjectId, ref: "Driver", default: null, index: true },
        pickup: {
            address: { type: String, required: true, trim: true },
            coordinates: { latitude: Number, longitude: Number },
        },
        destination: {
            address: { type: String, required: true, trim: true },
            coordinates: { latitude: Number, longitude: Number },
        },
        fare: {
            estimated: {
                type: Number,
                required: true,
            },

            final: {
                type: Number,
                default: null,
            },

            breakdown: {
                type: FareBreakdownSchema,
                default: null,
            }
        },
        distance: { estimated: Number, actual: { type: Number, default: null } },
        duration: { estimated: Number, actual: { type: Number, default: null } },
        status: { type: String, enum: Object.values(RideStatus), default: RideStatus.SEARCHING, index: true },
        paymentStatus: { type: String, enum: Object.values(RidePaymentStatus), default: RidePaymentStatus.PENDING },
        cancelledBy: { type: String, enum: ["RIDER", "DRIVER", "SYSTEM"], default: null },
        cancellationReason: { type: String, default: null },
        startedAt: Date,
        completedAt: Date,
        cancelledAt: Date,
    },
    { timestamps: true }
);

export const RideModel = model<IRide>("Ride", rideSchema);