import { Schema, model, Document, Types, Model } from "mongoose";

export interface IDriver extends Document {
    user: Types.ObjectId;
    profilePhoto: {
        url: string;
        publicId: string;
    };
    vehicleImages: {
        front: string;
        back: string;
        left: string;
        right: string;
        interior: string;
    };
    vehicle: {
        type: "CAR" | "BIKE" | "AUTO";
        brand: string;
        model: string;
        color: string;
        registrationNumber: string;
        registrationYear: number;
    };
    documents: {
        drivingLicense: {
            number: string;
            expiryDate: Date;
            frontImage: string;
            backImage: string;
            verified: boolean;
        };
        registrationCertificate: {
            number: string;
            image: string;
            verified: boolean;
        };
        insurance: {
            number: string;
            expiryDate: Date;
            image: string;
            verified: boolean;
        };
        pollutionCertificate: {
            expiryDate: Date;
            image: string;
        };
    };
    isVerified: boolean;
    verificationStatus: "PENDING" | "APPROVED" | "REJECTED";
    currentRide?: Types.ObjectId | null;
    rating: {
        average: number;
        totalRatings: number;
    };
    statistics: {
        totalTrips: number;
        completedTrips: number;
        cancelledTrips: number;
        totalDistance: number;
        totalEarnings: number;
    };
    lastOnlineAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const driverSchema = new Schema<IDriver>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true,
        },
        profilePhoto: {
            url: String,
            publicId: String
        },
        vehicleImages: {
            front: String,
            back: String,
            left: String,
            right: String,
            interior: String
        },
        vehicle: {
            type: {
                type: String,
                enum: ["CAR", "BIKE", "AUTO"],
                required: true,
            },
            brand: { type: String, required: true, trim: true },
            model: { type: String, required: true, trim: true },
            color: { type: String, required: true, trim: true },
            registrationNumber: {
                type: String,
                required: true,
                unique: true,
                uppercase: true,
                trim: true,
            },
            registrationYear: { type: Number, required: true }
        },
        documents: {
            drivingLicense: {
                number: String,
                expiryDate: Date,
                frontImage: String,
                backImage: String,
                verified: Boolean
            },
            registrationCertificate: {
                number: String,
                image: String,
                verified: Boolean
            },
            insurance: {
                number: String,
                expiryDate: Date,
                image: String,
                verified: Boolean
            },
            pollutionCertificate: {
                expiryDate: Date,
                image: String
            }
        },
        isVerified: { type: Boolean, default: false },
        verificationStatus: {
            type: String,
            enum: ["PENDING", "APPROVED", "REJECTED"],
            default: "PENDING",
        },
        currentRide: {
            type: Schema.Types.ObjectId,
            ref: "Ride",
            default: null,
        },
        rating: {
            average: { type: Number, default: 5, min: 1, max: 5 },
            totalRatings: { type: Number, default: 0 },
        },
        statistics: {
            totalTrips: { type: Number, default: 0 },
            completedTrips: { type: Number, default: 0 },
            cancelledTrips: { type: Number, default: 0 },
            totalDistance: { type: Number, default: 0 },
            totalEarnings: { type: Number, default: 0 },
        },
        lastOnlineAt: { type: Date },
    },
    { timestamps: true }
);

export type verificationStatus = "PENDING" | "APPROVED" | "REJECTED";
export const DriverModel: Model<IDriver> = model<IDriver>("Driver", driverSchema);