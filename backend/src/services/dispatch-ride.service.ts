import type { IRide } from "../models/ride.model.js";
import { RideModel, RideStatus } from "../models/ride.model.js";

import type { NearbyDriver } from "../redis/types.js";
import { findEligibleDrivers } from "./matching.service.js";

import { emitNewRideRequest } from "../sockets/emitters/driver.emitter.js";
import { emitNoDriversAvailable } from "../sockets/emitters/rider.emitter.js";

import { socketRegistry } from "../sockets/registry/socket.registry.js";

// ======================================================
// Constants
// ======================================================

const DISPATCH_BATCH_SIZE = 3;

const DISPATCH_TIMEOUT_MS = 15_000;

// ======================================================
// Types
// ======================================================

interface ActiveDispatch {

    ride: IRide;

    drivers: NearbyDriver[];

    currentIndex: number;

    timeout?: NodeJS.Timeout;

}

// ======================================================
// In-memory State
// ======================================================

const activeDispatches = new Map<
    string,
    ActiveDispatch
>();

// ======================================================
// Public Methods
// ======================================================

export async function dispatchRide(
    ride: IRide
): Promise<void> {

    //--------------------------------------------------
    // Find Eligible Drivers
    //--------------------------------------------------

    const drivers =
        await findEligibleDrivers(
            ride.pickup.coordinates.latitude,
            ride.pickup.coordinates.longitude
        );

    //--------------------------------------------------
    // No Drivers Available
    //--------------------------------------------------

    if (drivers.length === 0) {

        emitNoDriversAvailable(
            ride.rider.toString(),
            {
                rideId: ride._id.toString(),
            }
        );

        return;

    }

    //--------------------------------------------------
    // Prevent Duplicate Dispatch
    //--------------------------------------------------

    if (
        activeDispatches.has(
            ride._id.toString()
        )
    ) {
        return;
    }

    //--------------------------------------------------
    // Store Dispatch
    //--------------------------------------------------

    const dispatch: ActiveDispatch = {

        ride,

        drivers,

        currentIndex: 0,

    };

    activeDispatches.set(
        ride._id.toString(),
        dispatch
    );

    //--------------------------------------------------
    // Start First Batch
    //--------------------------------------------------

    await dispatchNextBatch(
        dispatch
    );

}

// ======================================================
// Private Methods
// ======================================================

async function dispatchNextBatch(
    dispatch: ActiveDispatch
): Promise<void> {

    //--------------------------------------------------
    // No More Drivers
    //--------------------------------------------------

    if (
        dispatch.currentIndex >=
        dispatch.drivers.length
    ) {

        notifyNoDriversAvailable(dispatch);

        cleanupDispatch(dispatch.ride._id.toString());

        return;

    }

    //--------------------------------------------------
    // Select Current Batch
    //--------------------------------------------------

    const batch = dispatch.drivers.slice(
        dispatch.currentIndex,
        dispatch.currentIndex +
        DISPATCH_BATCH_SIZE
    );

    //--------------------------------------------------
    // Notify Drivers
    //--------------------------------------------------

    const notifiedCount = notifyDrivers(
        dispatch,
        batch
    );

    //--------------------------------------------------
    // Advance Cursor
    //--------------------------------------------------

    dispatch.currentIndex +=
        DISPATCH_BATCH_SIZE;

    //--------------------------------------------------
    // Nobody was online
    //--------------------------------------------------

    if (notifiedCount === 0) {

        await dispatchNextBatch(
            dispatch
        );

        return;

    }

    //--------------------------------------------------
    // Clear Existing Timeout
    //--------------------------------------------------

    if (dispatch.timeout) {

        clearTimeout(
            dispatch.timeout
        );

    }

    //--------------------------------------------------
    // Wait For Acceptance
    //--------------------------------------------------

    dispatch.timeout = setTimeout(() => {

        void handleDispatchTimeout(
            dispatch.ride._id.toString()
        );

    }, DISPATCH_TIMEOUT_MS);

}

function notifyDrivers(
    dispatch: ActiveDispatch,
    batch: NearbyDriver[]
): number {

    let notified = 0;

    for (const driver of batch) {

        //--------------------------------------------------
        // Driver Online?
        //--------------------------------------------------

        if (
            !socketRegistry.isDriverOnline(
                driver.driverId
            )
        ) {
            continue;
        }

        //--------------------------------------------------
        // Emit Ride
        //--------------------------------------------------

        emitNewRideRequest(
            driver.driverId,
            {
                rideId: dispatch.ride._id.toString(),

                riderId:
                    dispatch.ride.rider.toString(),

                pickup: {
                    address:
                        dispatch.ride.pickup.address,

                    latitude:
                        dispatch.ride.pickup.coordinates.latitude,

                    longitude:
                        dispatch.ride.pickup.coordinates.longitude,
                },

                destination: {
                    address:
                        dispatch.ride.destination.address,

                    latitude:
                        dispatch.ride.destination.coordinates.latitude,

                    longitude:
                        dispatch.ride.destination.coordinates.longitude,
                },

                estimatedFare:
                    dispatch.ride.fare.estimated,
            }
        );

        notified++;

    }

    return notified;

}

async function isRideAccepted(
    rideId: string
): Promise<boolean> {

    const ride = await RideModel.findById(
        rideId
    )
        .select("status")
        .lean();

    if (!ride) {
        return true;
    }

    return (
        ride.status !==
        RideStatus.SEARCHING
    );

}

async function handleDispatchTimeout(
    rideId: string
): Promise<void> {

    //--------------------------------------------------
    // Dispatch Still Active?
    //--------------------------------------------------

    const dispatch =
        activeDispatches.get(rideId);

    if (!dispatch) {
        return;
    }

    //--------------------------------------------------
    // Ride Accepted?
    //--------------------------------------------------

    const accepted =
        await isRideAccepted(
            rideId
        );

    if (accepted) {

        cleanupDispatch(
            rideId
        );

        return;

    }

    //--------------------------------------------------
    // Dispatch Next Batch
    //--------------------------------------------------

    await dispatchNextBatch(
        dispatch
    );

}

function notifyNoDriversAvailable(
    dispatch: ActiveDispatch
): void {

    emitNoDriversAvailable(
        dispatch.ride.rider.toString(),
        {
            rideId:
                dispatch.ride._id.toString(),
        }
    );

}

function cleanupDispatch(
    rideId: string
): void {

    const dispatch =
        activeDispatches.get(
            rideId
        );

    if (!dispatch) {
        return;
    }

    if (dispatch.timeout) {

        clearTimeout(
            dispatch.timeout
        );

        dispatch.timeout =
            undefined;

    }

    activeDispatches.delete(
        rideId
    );

}

export function stopDispatch(
    rideId: string
): void {

    cleanupDispatch(
        rideId
    );

}

export function isDispatchActive(
    rideId: string
): boolean {

    return activeDispatches.has(
        rideId
    );

}