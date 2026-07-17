import { Router } from "express";

import {
    acceptRide,
    arriveRide,
    cancelRide,
    cancelRideByDriver,
    completeRide,
    createRide,
    getCurrentRide,
    getCurrentRideOfDriver,
    getRideById,
    getRidesHistory,
    startRide,
} from "../controllers/ride.controller.js";

import {
    authMiddleware,
} from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authMiddleware);

// ============================================================================
// Rider
// ============================================================================

router.post(
    "/",
    createRide
);

router.get(
    "/current",
    getCurrentRide
);

router.get(
    "/history",
    getRidesHistory
);

router.get(
    "/:rideId",
    getRideById
);

router.patch(
    "/:rideId/cancel",
    cancelRide
);

// ============================================================================
// Driver
// ============================================================================

router.get(
    "/driver/current",
    getCurrentRideOfDriver
);

router.patch(
    "/:rideId/accept",
    acceptRide
);

router.patch(
    "/:rideId/arrive",
    arriveRide
);

router.patch(
    "/:rideId/start",
    startRide
);

router.patch(
    "/:rideId/complete",
    completeRide
);

router.patch(
    "/:rideId/driver/cancel",
    cancelRideByDriver
);

export default router;