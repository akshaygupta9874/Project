// RideService

// ✅ createRide()

// ✅ acceptRide()

// ✅ arriveAtPickup()

// ✅ startRide()

// ✅ completeRide()

// ✅ cancelRide()

// ✅ getRideById()

// ✅ getDriverCurrentRide()

// ✅ getRiderCurrentRide()


import mongoose, { Types } from "mongoose";
import { setDriverAvailable, setDriverBusy } from "../redis/services/driver-presence.service.js";
import {
    IRide,
    RideModel,
    RidePaymentStatus,
    RideStatus,
} from "../models/ride.model.js";

import { paymentService } from "../payment/services/payment.service.js";
import { PaymentStatus } from "../payment/types/payment.types.js";
import { fareService } from "./fare.service.js";

import { DriverModel } from "../models/driver.model.js";
import { emitRideAccepted, emitDriverArrived, emitRideStarted, emitRideCancelled, emitRideCompleted } from "../sockets/emitters/rider.emitter.js";
import { stopDispatch, dispatchRide } from "./dispatch-ride.service.js";
import { AppError } from "../utils/AppError.js";

export interface CreateRideInput {
    riderId: string;

    pickup: {
        address: string;
        coordinates: {
            latitude: number;
            longitude: number;
        };
    };

    destination: {
        address: string;
        coordinates: {
            latitude: number;
            longitude: number;
        };
    };

    estimatedFare: number;
    estimatedDistance: number;
    estimatedDuration: number;
}

export interface AcceptRideInput {
    rideId: string;
    driverId: string;
}

export interface ArriveAtPickupInput {
    rideId: string;
    driverId: string;
}
export interface StartRideInput {
    rideId: string;
    driverId: string;
}
export interface CancelRideInput {
    rideId: string;
    userId: string;
    reason?: string;
}
export interface CompleteRideInput {
    rideId: string;
    driverId: string;
}
export interface GetRideByIdInput {
    rideId: string;
}

export interface GetDriverCurrentRideInput {
    driverId: string;
}
export interface GetRiderCurrentRideInput {
    riderId: string;
}
export interface GetRiderRideHistoryInput {
    riderId: string;
}
export interface CancelRideByDriverInput {
    rideId: string;
    driverId: string;
    reason?: string;
}
export interface GetDriverRideHistoryInput {
    driverId: string;
}



export async function createRide(
    input: CreateRideInput
): Promise<IRide> {

    const session = await mongoose.startSession();

    try {

        session.startTransaction();

        //--------------------------------------------------
        // Rider already has an active ride?
        //--------------------------------------------------

        const existingRide = await RideModel.findOne({
            rider: input.riderId,
            status: {
                $nin: [
                    RideStatus.COMPLETED,
                    RideStatus.CANCELLED,
                ],
            },
        }).session(session);

        if (existingRide) {
            throw new Error(
                "Rider already has an active ride."
            );
        }

        //--------------------------------------------------
        // Create Ride
        //--------------------------------------------------

        const ride = new RideModel({
            rider: new Types.ObjectId(input.riderId),

            pickup: input.pickup,

            destination: input.destination,

            fare: {
                estimated: input.estimatedFare,
            },

            distance: {
                estimated: input.estimatedDistance,
            },

            duration: {
                estimated: input.estimatedDuration,
            },

            status: RideStatus.SEARCHING,

            paymentStatus: PaymentStatus.PENDING,
        });

        await ride.save({ session });

        //--------------------------------------------------
        // Commit Mongo Transaction
        //--------------------------------------------------

        await session.commitTransaction();

        //--------------------------------------------------
        // Start Ride Dispatch
        //--------------------------------------------------

        try {

            await dispatchRide(
                ride
            );

        } catch (err) {

            console.error(
                "Ride dispatch failed:",
                err
            );

        }

        //--------------------------------------------------
        // Return Ride
        //--------------------------------------------------

        return ride;

    } catch (err) {

        await session.abortTransaction();

        throw err;

    } finally {

        await session.endSession();

    }

}

export async function acceptRide(
    input: AcceptRideInput
): Promise<IRide> {

    const session = await mongoose.startSession();

    try {

        session.startTransaction();

        //--------------------------------------------------
        // Find Driver
        //--------------------------------------------------

        const driver = await DriverModel.findById(
            input.driverId
        ).session(session);

        if (!driver) {
            throw new Error("Driver not found.");
        }

        //--------------------------------------------------
        // Driver verified?
        //--------------------------------------------------

        if (driver.verificationStatus!== "APPROVED") {
            throw new Error("Driver is not verified.");
        }

        //--------------------------------------------------
        // Driver already on another ride?
        //--------------------------------------------------

        console.log(driver.currentRide)

        if (driver.currentRide!==null) {
            throw new Error(
                "Driver already has an active ride."
            );
        }

        //--------------------------------------------------
        // Atomically assign driver
        //--------------------------------------------------

        const ride = await RideModel.findOneAndUpdate(
            {
                _id: input.rideId,
                status: RideStatus.SEARCHING,
            },
            {
                $set: {
                    status: RideStatus.DRIVER_ASSIGNED,
                    driver: driver._id,
                },
            },
            {
                new: true,
                session,
            }
        );

        if (!ride) {
            throw new AppError(
                "Ride not found or already accepted."
            );
        }

        //--------------------------------------------------
        // Update Driver
        //--------------------------------------------------

        driver.currentRide =
            ride._id as Types.ObjectId;

        await driver.save({ session });

        //--------------------------------------------------
        // Commit Transaction
        //--------------------------------------------------

        await session.commitTransaction();

        //--------------------------------------------------
        // Stop Ride Dispatch
        //--------------------------------------------------

        stopDispatch(
            ride.id
        );

        //--------------------------------------------------
        // Driver is now unavailable
        //--------------------------------------------------

        await setDriverBusy(
            input.driverId
        );

        //--------------------------------------------------
        // Notify Rider
        //--------------------------------------------------

        emitRideAccepted(
            ride.rider.toString(),
            {
                ride : ride,
            }
        );

        //--------------------------------------------------
        // Return Ride
        //--------------------------------------------------

        return ride;

    } catch (err) {

        await session.abortTransaction();

        throw err;

    } finally {

        await session.endSession();

    }

}
export async function arriveAtPickup(
    input: ArriveAtPickupInput
): Promise<IRide> {

    const ride = await RideModel.findOneAndUpdate(
        {
            _id: input.rideId,
            driver: input.driverId,
            status: RideStatus.DRIVER_ASSIGNED,
        },
        {
            $set: {
                status: RideStatus.DRIVER_ARRIVING,
            },
        },
        {
            new: true,
        }
    );

    if (!ride) {
        throw new AppError(
            "Ride not found or cannot be marked as arrived."
        );
    }

    //--------------------------------------------------
    // Notify Rider
    //--------------------------------------------------

    emitDriverArrived(
        ride.rider.toString(),
        {
            rideId: ride.id,
        }
    );
    return ride;
}

export async function startRide(
    input: StartRideInput
): Promise<IRide> {

    const ride = await RideModel.findOneAndUpdate(
        {
            _id: input.rideId,
            driver: input.driverId,
            status: RideStatus.DRIVER_ARRIVING,
        },
        {
            $set: {
                status: RideStatus.STARTED,
                startedAt: new Date(),
            },
        },
        {
            new: true,
        }
    );

    if (!ride) {
        throw new AppError(
            "Ride not found or cannot be started."
        );
    }

    //--------------------------------------------------
    // Notify Rider
    //--------------------------------------------------

    emitRideStarted(
        ride.rider.toString(),
        {
            rideId: ride.id,
        }
    );

    return ride;
}

export async function cancelRide(
    input: CancelRideInput
): Promise<IRide> {

    const session = await mongoose.startSession();

    try {

        session.startTransaction();

        //--------------------------------------------------
        // Cancel Ride
        //--------------------------------------------------

        const ride = await RideModel.findOneAndUpdate(
            {
                _id: input.rideId,
                rider: input.userId,
                status: {
                    $in: [
                        RideStatus.SEARCHING,
                        RideStatus.DRIVER_ASSIGNED,
                        RideStatus.DRIVER_ARRIVING,
                    ],
                },
            },
            {
                $set: {
                    status: RideStatus.CANCELLED,
                    cancelledBy: "RIDER",
                    cancellationReason:
                        input.reason ?? null,
                    cancelledAt: new Date(),
                },
            },
            {
                new: true,
                session,
            }
        );

        if (!ride) {
            throw new Error(
                "Ride not found or cannot be cancelled."
            );
        }

        //--------------------------------------------------
        // Free Driver (if assigned)
        //--------------------------------------------------

        if (ride.driver) {

            await DriverModel.findByIdAndUpdate(
                ride.driver,
                {
                    $set: {
                        currentRide: null,
                    },
                    $inc: {
                        "statistics.cancelledTrips": 1,
                    },
                },
                {
                    session,
                }
            );

        }

        //--------------------------------------------------
        // Commit
        //--------------------------------------------------

        await session.commitTransaction();

        //--------------------------------------------------
        // Stop Dispatch
        //--------------------------------------------------

        stopDispatch(
            ride.id
        );

        //--------------------------------------------------
        // Driver becomes available again
        //--------------------------------------------------

        if (ride.driver) {

            await setDriverAvailable(
                ride.driver.toString()
            );

        }

        //--------------------------------------------------
        // Notify Driver
        //--------------------------------------------------

        if (ride.driver) {

            emitRideCancelled(
                ride.driver.toString(),
                {
                    rideId: ride._id.toString(),
                    cancelledBy: "RIDER",
                    reason: input.reason

                }
            );

        }

        return ride;

    } catch (err) {

        await session.abortTransaction();

        throw err;

    } finally {

        await session.endSession();

    }

}

export async function completeRide(
    input: CompleteRideInput
): Promise<IRide> {

    const session = await mongoose.startSession();

    try {

        session.startTransaction();

        //--------------------------------------------------
        // Find Driver
        //--------------------------------------------------

        const driver = await DriverModel.findById(
            input.driverId
        ).session(session);

        if (!driver) {
            throw new Error("Driver not found.");
        }

        //--------------------------------------------------
        // Find Ride
        //--------------------------------------------------

        const ride = await RideModel.findOne({
            _id: input.rideId,
            driver: driver._id,
            status: RideStatus.STARTED,
        }).session(session);

        if (!ride) {
            throw new Error(
                "Ride not found or cannot be completed."
            );
        }

        //--------------------------------------------------
        // Complete Ride
        //--------------------------------------------------

        ride.status = RideStatus.COMPLETED;
        ride.completedAt = new Date();

        ride.paymentStatus = RidePaymentStatus.PENDING;
        const finalFare = fareService.calculateFinalFare(ride)

        ride.fare.final = finalFare.totalPaise;
        ride.fare.breakdown =
            finalFare;
        //--------------------------------------------------
        // Free Driver
        //--------------------------------------------------

        driver.currentRide = null;

        //--------------------------------------------------
        // Update Driver Statistics
        //--------------------------------------------------

        driver.statistics.totalTrips += 1;

        driver.statistics.completedTrips += 1;

        driver.statistics.totalDistance +=
            ride.distance.actual ??
            ride.distance.estimated;

        driver.statistics.totalEarnings +=
            finalFare.driverEarningPaise ??
            ride.fare.estimated;

        //--------------------------------------------------
        // Save
        //--------------------------------------------------

        await Promise.all([
            ride.save({ session }),
            driver.save({ session }),
        ]);

        //--------------------------------------------------
        // Commit
        //--------------------------------------------------

        await session.commitTransaction();

        //--------------------------------------------------
        // Redis
        //--------------------------------------------------

        await setDriverAvailable(
            input.driverId
        );

        //--------------------------------------------------
        // Notify Rider
        //--------------------------------------------------

        emitRideCompleted(
            ride.rider.toString(),
            {
                rideId: ride.id,
            }
        );

        return ride;

    } catch (err) {

        await session.abortTransaction();

        throw err;

    } finally {

        await session.endSession();

    }

}

export async function getRideById(
    input: GetRideByIdInput
): Promise<IRide> {

    const ride = await RideModel.findById(input.rideId)
        .populate("rider")
        .populate("driver");

    if (!ride) {
        throw new Error("Ride not found.");
    }

    return ride;
}

export async function getDriverCurrentRide(
    input: GetDriverCurrentRideInput
): Promise<IRide | null> {

    const driver = await DriverModel.findById(input.driverId);

    if (!driver) {
        throw new AppError("Driver not found.");
    }

    if (!driver.currentRide) {
        return null;
    }

    const ride = await RideModel.findById(driver.currentRide)
        .populate("rider")
        .populate("driver");

    return ride;
}

export async function getRiderCurrentRide(
    input: GetRiderCurrentRideInput
): Promise<IRide | null> {

    const ride = await RideModel.findOne({
        rider: input.riderId,
        status: {
            $nin: [
                RideStatus.COMPLETED,
                RideStatus.CANCELLED,
            ],
        },
    })
        .populate("rider")
        .populate("driver");

    return ride;
}

export async function getRiderRideHistory(
    input: GetRiderRideHistoryInput
): Promise<IRide[]> {

    return RideModel.find({
        rider: input.riderId,
    })
        .sort({ createdAt: -1 });

}

export async function cancelRideByDriver(
    input: CancelRideByDriverInput
): Promise<IRide> {

    const session = await mongoose.startSession();

    try {

        session.startTransaction();

        //--------------------------------------------------
        // Find Driver
        //--------------------------------------------------

        const driver = await DriverModel.findById(
            input.driverId
        ).session(session);

        if (!driver) {
            throw new AppError("Driver not found.");
        }

        //--------------------------------------------------
        // Cancel Ride
        //--------------------------------------------------

        const ride = await RideModel.findOneAndUpdate(
            {
                _id: input.rideId,
                driver: driver._id,
                status: {
                    $in: [
                        RideStatus.DRIVER_ASSIGNED,
                        RideStatus.DRIVER_ARRIVING,
                    ],
                },
            },
            {
                $set: {
                    status: RideStatus.CANCELLED,
                    cancelledBy: "DRIVER",
                    cancellationReason:
                        input.reason ?? null,
                    cancelledAt: new Date(),
                },
            },
            {
                new: true,
                session,
            }
        );

        if (!ride) {
            throw new AppError(
                "Ride not found or cannot be cancelled."
            );
        }

        //--------------------------------------------------
        // Free Driver
        //--------------------------------------------------

        driver.currentRide = null;

        driver.statistics.cancelledTrips += 1;

        await driver.save({
            session,
        });

        //--------------------------------------------------
        // Commit Transaction
        //--------------------------------------------------

        await session.commitTransaction();

        //--------------------------------------------------
        // Stop Dispatch (safe if already stopped)
        //--------------------------------------------------

        stopDispatch(
            ride.id
        );

        //--------------------------------------------------
        // Driver becomes available again
        //--------------------------------------------------

        await setDriverAvailable(
            input.driverId
        );

        //--------------------------------------------------
        // Notify Rider
        //--------------------------------------------------

        emitRideCancelled(
            ride.rider.toString(),
            {
                rideId: ride.id,
                cancelledBy: "DRIVER",
                reason: input.reason
            }
        );

        //--------------------------------------------------
        // TODO:
        // Notify Driver (optional)
        //--------------------------------------------------

        return ride;

    } catch (err) {

        await session.abortTransaction();

        throw err;

    } finally {

        await session.endSession();

    }

}

export async function getDriverRideHistory(
    input: GetDriverRideHistoryInput
): Promise<IRide[]> {

    return RideModel.find({
        driver: input.driverId,
        status: {
            $in: [
                RideStatus.COMPLETED,
                RideStatus.CANCELLED,
            ],
        },
    })
        .sort({
            createdAt: -1,
        });

}