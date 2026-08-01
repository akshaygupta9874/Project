import { Router } from "express";
import { driverProfileController, driverRegistrationController } from "../controllers/driver.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { uploadDriverDocuments } from "../middlewares/driver-upload.middleware.js";

const driverRouter = Router();

driverRouter.post("/register",uploadDriverDocuments,authMiddleware,driverRegistrationController)
driverRouter.get("/profile",authMiddleware,driverProfileController);


export default driverRouter;