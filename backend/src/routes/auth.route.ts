import express from "express" ; 
import {forgotPasswordController, myProfile, refreshToken, resendOtpController, resendVerificationEmailController, resetPasswordController, userLoginController, userLogoutController, userRegistrationController} from "../controllers/auth.controller.js"
import { verifyEmail, verifyOTP } from "../config/sendMail.config.js";
import { authMiddleware } from "../middlewares/isAuthenticated.js";
import { verifyCsrfToken } from "../middlewares/csrfMiddleware.js";

const authRouter = express.Router();

authRouter.post("/register",userRegistrationController)
authRouter.post("/verify/:token",verifyEmail)
authRouter.post("/resend-verification-email",authMiddleware,verifyCsrfToken,resendVerificationEmailController)
authRouter.post("/login",userLoginController);
authRouter.post("/verify-otp",verifyOTP)
authRouter.post("/resend-otp",authMiddleware,verifyCsrfToken,resendOtpController)
authRouter.post("/forgot-password",forgotPasswordController)
authRouter.post("/reset-password",resetPasswordController)
authRouter.get("/myprofile",authMiddleware,myProfile)
authRouter.post("/refresh",refreshToken)
authRouter.post("/logout",authMiddleware,verifyCsrfToken,userLogoutController) 



export default authRouter;
