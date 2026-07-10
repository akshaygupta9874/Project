import asyncTryCatchHandler from "../middlewares/TryCatch.js";
import { ForgotPasswordSchema, ResendOtpSchema, ResendVerificationEmailSchema, ResetPasswordSchema, UserLoginSchema, UserRegistrationSchema } from "../zodSchemas/user.schema.js";
import UserModel from "../models/user.model.js";
import { redisClient } from "../index.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendOtpEmail, sendResetPasswordEmail, sendVerifyEmail } from "../config/sendMail.config.js";
import { generateAccessToken, revokeRefreshToken, verifyRefreshToken } from "../utils/generateToken.js";
import { generateCSRFToken, revokeCSRFToken } from "../middlewares/csrfMiddleware.js";
export const userRegistrationController = asyncTryCatchHandler(async (request, response) => {
    const validatedData = UserRegistrationSchema.safeParse(request.body);
    if (!validatedData.success) {
        return response.status(400).json({
            message: "Please enter valid registration details."
        });
    }
    const { firstName, lastName, email, password } = validatedData.data;
    const rateLimitKey = `register-rate-limit:${request.ip}:${email}`;
    if (await redisClient.get(rateLimitKey)) {
        return response.status(429).json({
            message: "Too many attempts. Please try again later."
        });
    }
    const existingUser = await UserModel.findOne({
        email: email
    });
    if (existingUser) {
        return response.status(400).json({
            message: "This email is already registered. Please sign in or use another email."
        });
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const verifyKey = `verify:${verifyToken}`;
    const dataToStore = JSON.stringify({
        firstName,
        lastName,
        email,
        password: hashedPassword
    });
    await redisClient.set(verifyKey, dataToStore, {
        EX: 300
    });
    await redisClient.set(`verify:email:${email}`, dataToStore, {
        EX: 300
    });
    await sendVerifyEmail({ email: email, token: verifyToken });
    await redisClient.set(rateLimitKey, "true", { EX: 60 });
    response.status(200).json({
        message: "A verification link has been sent to your email. Please check your inbox."
    });
});
export const userLoginController = asyncTryCatchHandler(async (request, response) => {
    const validatedData = UserLoginSchema.safeParse(request.body);
    if (!validatedData.success) {
        return response.status(400).json({
            message: "Please enter a valid email and password."
        });
    }
    const { email, password } = validatedData.data;
    const rateLimitKey = `login-rate-limit:${request.ip}:${email}`;
    if (await redisClient.get(rateLimitKey)) {
        return response.status(429).json({
            message: "Too many attempts. Please try again later."
        });
    }
    const userFound = await UserModel.findOne({
        email: email
    }).select("+password");
    if (!userFound) {
        return response.status(400).json({
            message: "Invalid email or password."
        });
    }
    const isPasswordMatched = await userFound.comparePassword(password);
    if (!isPasswordMatched) {
        return response.status(400).json({
            message: "Invalid email or password."
        });
    }
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpJSON = JSON.stringify(otp);
    const otpKey = `otp:${email}`;
    await redisClient.set(otpKey, otpJSON, { EX: 300 });
    await sendOtpEmail({ email, otp, expiresInMinutes: 5 });
    await redisClient.set(rateLimitKey, "true", { EX: 60 });
    response.status(200).json({
        message: "A verification code has been sent to your email."
    });
});
export const forgotPasswordController = asyncTryCatchHandler(async (request, response) => {
    const validatedData = ForgotPasswordSchema.safeParse(request.body);
    if (!validatedData.success) {
        return response.status(400).json({
            message: "Please enter a valid email address."
        });
    }
    const { email } = validatedData.data;
    const rateLimitKey = `forgot-password-rate-limit:${request.ip}:${email}`;
    if (await redisClient.get(rateLimitKey)) {
        return response.status(429).json({
            message: "Too many attempts. Please try again later."
        });
    }
    const userFound = await UserModel.findOne({ email });
    if (!userFound) {
        await redisClient.set(rateLimitKey, "true", { EX: 60 });
        return response.status(200).json({
            message: "If an account exists for this email, a password reset link has been sent."
        });
    }
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetKey = `reset-password:${resetToken}`;
    await redisClient.set(resetKey, JSON.stringify({ email }), { EX: 15 * 60 });
    await sendResetPasswordEmail({ email, token: resetToken });
    await redisClient.set(rateLimitKey, "true", { EX: 60 });
    response.status(200).json({
        message: "If an account exists for this email, a password reset link has been sent."
    });
});
export const resetPasswordController = asyncTryCatchHandler(async (request, response) => {
    const validatedData = ResetPasswordSchema.safeParse(request.body);
    if (!validatedData.success) {
        return response.status(400).json({
            message: "Please provide a valid password reset request."
        });
    }
    const { token, newPassword } = validatedData.data;
    const resetKey = `reset-password:${token}`;
    const resetDataJSON = await redisClient.get(resetKey);
    if (!resetDataJSON) {
        return response.status(400).json({
            message: "This password reset link is invalid or has expired."
        });
    }
    const { email } = JSON.parse(resetDataJSON);
    const userFound = await UserModel.findOne({ email });
    if (!userFound) {
        return response.status(404).json({
            message: "This password reset link is invalid or has expired."
        });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await UserModel.updateOne({ _id: userFound._id }, { password: hashedPassword });
    await revokeRefreshToken(userFound._id.toString());
    await redisClient.del(`user:${userFound._id.toString()}`);
    await redisClient.del(resetKey);
    response.status(200).json({
        message: "Password reset successfully"
    });
});
export const resendVerificationEmailController = asyncTryCatchHandler(async (request, response) => {
    const validatedData = ResendVerificationEmailSchema.safeParse(request.body);
    if (!validatedData.success) {
        return response.status(400).json({
            message: "Please provide a valid email address."
        });
    }
    const { email } = validatedData.data;
    const rateLimitKey = `resend-verification-rate-limit:${request.ip}:${email}`;
    if (await redisClient.get(rateLimitKey)) {
        return response.status(429).json({
            message: "Too many attempts. Please try again later."
        });
    }
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
        return response.status(409).json({
            message: "We couldn't resend the verification email. Please try again later."
        });
    }
    const pendingDataJSON = await redisClient.get(`verify:email:${email}`);
    if (!pendingDataJSON) {
        return response.status(400).json({
            message: "We couldn't resend the verification email. Please try again later."
        });
    }
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const verifyKey = `verify:${verifyToken}`;
    await redisClient.set(verifyKey, pendingDataJSON, { EX: 300 });
    await redisClient.set(`verify:email:${email}`, pendingDataJSON, { EX: 300 });
    await sendVerifyEmail({ email, token: verifyToken });
    await redisClient.set(rateLimitKey, "true", { EX: 60 });
    response.status(200).json({
        message: "Verification email resent successfully"
    });
});
export const resendOtpController = asyncTryCatchHandler(async (request, response) => {
    const validatedData = ResendOtpSchema.safeParse(request.body);
    if (!validatedData.success) {
        return response.status(400).json({
            message: "Please provide a valid email address."
        });
    }
    const { email } = validatedData.data;
    const rateLimitKey = `resend-otp-rate-limit:${request.ip}:${email}`;
    if (await redisClient.get(rateLimitKey)) {
        return response.status(429).json({
            message: "Too many attempts. Please try again later."
        });
    }
    const userFound = await UserModel.findOne({ email });
    if (!userFound) {
        return response.status(400).json({
            message: "We couldn't resend the verification code. Please try again later."
        });
    }
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpJSON = JSON.stringify(otp);
    const otpKey = `otp:${email}`;
    await redisClient.set(otpKey, otpJSON, { EX: 300 });
    await sendOtpEmail({ email, otp, expiresInMinutes: 5 });
    await redisClient.set(rateLimitKey, "true", { EX: 60 });
    response.status(200).json({
        message: "OTP resent successfully"
    });
});
export const myProfile = asyncTryCatchHandler(async (request, response) => {
    const userId = request.userId;
    const user = await redisClient.get(`user:${userId}`);
    const parsedUser = JSON.parse(user);
    return response.json(parsedUser);
});
export const refreshToken = asyncTryCatchHandler(async (request, response) => {
    const refreshToken = request.cookies.refreshToken;
    if (!refreshToken) {
        return response.status(403).json({
            message: "please provide refresh token"
        });
    }
    const userId = await verifyRefreshToken(refreshToken);
    if (!userId) {
        return response.status(401).json({
            message: "Invalid refresh token"
        });
    }
    await generateAccessToken(userId, response);
    response.status(200).json({
        message: "Token Refreshed"
    });
});
export const userLogoutController = asyncTryCatchHandler(async (request, response) => {
    const userId = request.userId;
    if (!userId) {
        return response.status(401).json({
            message: "Unauthorized",
        });
    }
    await revokeRefreshToken(userId, request.sessionID ?? undefined);
    await redisClient.del(`user:${userId}`);
    response.clearCookie("accessToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
    });
    response.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
    });
    response.clearCookie("csrfToken", {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
    });
    // Destroy Redis Session + sessionId cookie
    request.session.destroy?.((err) => {
        if (err) {
            return response.status(500).json({
                message: "Failed to destroy session",
            });
        }
        return response.status(200).json({
            message: "User logged out successfully",
        });
    });
});
export const refreshCSRF = asyncTryCatchHandler(async (request, response) => {
    const userId = request.userId;
    if (!userId) {
        return response.status(401).json({
            message: "User Not Authenticated"
        });
    }
    await revokeCSRFToken(userId);
    const newCSRFToken = generateCSRFToken(userId, response);
    return response.status(200).json({
        message: "CSRF Token Refreshed",
        csrfToken: newCSRFToken
    });
});
//# sourceMappingURL=user.controller.js.map