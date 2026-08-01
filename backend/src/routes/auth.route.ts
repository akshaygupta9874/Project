import express from "express";

import {
    userRegistrationController,
    userLoginController,
    forgotPasswordController,
    resetPasswordController,
    resendVerificationEmailController,
    resendOtpController,
    myProfile,
    refreshToken,
    userLogoutController,
} from "../controllers/auth.controller.js";

import {
    verifyEmail,
    verifyOTP,
} from "../config/sendMail.config.js";

import {
    authMiddleware,
} from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post(
    "/register",
    userRegistrationController
);

router.post(
    "/login",
    userLoginController
);

router.post(
    "/refresh",
    refreshToken
);

router.post(
    "/forgot-password",
    forgotPasswordController
);

router.post(
    "/reset-password",
    resetPasswordController
);

router.post(
    "/verify/:token",
    verifyEmail
);

router.post(
    "/verify-otp",
    verifyOTP
);

router.post(
    "/resend-verification-email",
    resendVerificationEmailController
);

router.post(
    "/resend-otp",
    resendOtpController
);

router.get(
    "/me",
    authMiddleware,
    myProfile
);

router.post(
    "/logout",
    authMiddleware,
    userLogoutController
);

export default router;
