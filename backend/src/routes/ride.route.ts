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
import { authMiddleware } from "../middlewares/auth.middleware.js";

const rideRouter = Router();

rideRouter.use(authMiddleware)

// Rider Routes
rideRouter.post("/createRide", createRide);

rideRouter.get("/current", getCurrentRide);

rideRouter.get("/history", getRidesHistory);

rideRouter.get("/:rideId", getRideById);

rideRouter.patch("/:rideId/cancel", cancelRide);

// Driver Routes
rideRouter.get("/driver/current", getCurrentRideOfDriver);

rideRouter.patch("/:rideId/accept", acceptRide);

rideRouter.patch("/:rideId/arrive", arriveRide);

rideRouter.patch("/:rideId/start", startRide);

rideRouter.patch("/:rideId/complete", completeRide);

rideRouter.patch("/:rideId/driver/cancel", cancelRideByDriver);

export default rideRouter;