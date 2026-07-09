import express from "express" ; 
import {myProfile, refreshToken, userLoginController, userLogoutController, userRegistrationController} from "../controllers/user.controller.js"
import { verifyEmail, verifyOTP } from "../config/sendMail.config.js";
import { authMiddleware } from "../middlewares/isAuthenticated.js";

const userRouter = express.Router();

userRouter.post("/register",userRegistrationController)
userRouter.post("/verify/:token",verifyEmail)
userRouter.post("/login",userLoginController);
userRouter.post("/verify-otp",verifyOTP)
userRouter.get("/myprofile",authMiddleware,myProfile)
userRouter.post("/refresh",refreshToken)
userRouter.post("/logout",authMiddleware,userLogoutController)



export default userRouter;
