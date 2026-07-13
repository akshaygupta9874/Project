import { Router } from "express";
import { driverProfileController, driverRegistrationController, updateDriverLocationController } from "../controllers/driver.controller.js";
import { authMiddleware } from "../middlewares/isAuthenticated.js";

const driverRouter = Router();

driverRouter.post("/register",authMiddleware,driverRegistrationController)
driverRouter.get("/profile",authMiddleware,driverProfileController);
driverRouter.patch("/updateLocation",authMiddleware,updateDriverLocationController)


export default driverRouter;