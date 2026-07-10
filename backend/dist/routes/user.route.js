import express from "express";
import { forgotPasswordController, myProfile, refreshToken, resendOtpController, resendVerificationEmailController, resetPasswordController, userLoginController, userLogoutController, userRegistrationController } from "../controllers/user.controller.js";
import { verifyEmail, verifyOTP } from "../config/sendMail.config.js";
import { authMiddleware } from "../middlewares/isAuthenticated.js";
import { verifyCsrfToken } from "../middlewares/csrfMiddleware.js";
const userRouter = express.Router();
userRouter.post("/register", userRegistrationController);
userRouter.post("/verify/:token", verifyEmail);
userRouter.post("/resend-verification-email", authMiddleware, verifyCsrfToken, resendVerificationEmailController);
userRouter.post("/login", userLoginController);
userRouter.post("/verify-otp", verifyOTP);
userRouter.post("/resend-otp", authMiddleware, verifyCsrfToken, resendOtpController);
userRouter.post("/forgot-password", forgotPasswordController);
userRouter.post("/reset-password", resetPasswordController);
userRouter.get("/myprofile", authMiddleware, myProfile);
userRouter.post("/refresh", refreshToken);
userRouter.post("/logout", authMiddleware, verifyCsrfToken, userLogoutController);
export default userRouter;
//# sourceMappingURL=user.route.js.map