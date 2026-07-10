import nodemailer from "nodemailer";
import { redisClient } from "../index.js";
import UserModel from "../models/user.model.js";
import asyncTryCatchHandler from "../middlewares/TryCatch.js";
import { generateToken } from "../utils/generateToken.js";
import { registerSession, revokeUserSessions } from "../middlewares/session.middleware.js";
import { generateCSRFToken } from "../middlewares/csrfMiddleware.js";
/**
 * Shared branding config — pulled once so both templates stay in sync.
 */
const APP_NAME = process.env.APP_NAME || "Authentication App";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const ACCENT = "#111827"; // header / button color
const YEAR = new Date().getFullYear();
/**
 * Shared <style> block + wrapper markup used by every email so the
 * header, footer, and container render identically across templates.
 */
const baseStyles = `
  html, body { margin: 0; padding: 0; }
  body {
    background: #f6f7fb;
    color: #111;
    -webkit-text-size-adjust: 100%;
    -ms-text-size-adjust: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial,
      'Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol', sans-serif;
  }
  table { border-collapse: collapse; }
  img { border: 0; line-height: 100%; outline: none; text-decoration: none; display: block; max-width: 100%; height: auto; }
  .wrapper { width: 100%; background: #f6f7fb; }
  .container {
    width: 600px;
    max-width: 600px;
    background: #ffffff;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #e9ecf3;
  }
  .p-24 { padding: 24px; }
  .p-32 { padding: 32px; }
  .header {
    background: ${ACCENT};
    padding: 20px 24px;
    text-align: center;
  }
  .brand {
    display: inline-block;
    color: #ffffff;
    font-weight: 700;
    font-size: 17px;
    letter-spacing: 0.3px;
    text-decoration: none;
  }
  .title { margin: 0 0 12px 0; font-size: 22px; line-height: 1.3; color: #111; font-weight: 700; }
  .text { margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #444; }
  .muted { color: #555; font-size: 14px; line-height: 1.6; margin: 0 0 12px 0; }
  .otp-wrap { margin: 24px 0; width: 100%; }
  .otp {
    display: inline-block;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 16px 22px;
    font-size: 32px;
    letter-spacing: 10px;
    font-weight: 700;
    color: #111;
    font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }
  .btn {
    display: inline-block;
    background: ${ACCENT};
    color: #ffffff !important;
    text-decoration: none;
    padding: 12px 20px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
  }
  .link { color: ${ACCENT}; text-decoration: underline; word-break: break-all; }
  .footer { text-align: center; color: #6b7280; font-size: 12px; line-height: 1.6; padding: 16px 24px 0 24px; }
  @media only screen and (max-width: 600px) {
    .container { width: 100% !important; }
    .p-32 { padding: 24px !important; }
    .otp { font-size: 26px !important; letter-spacing: 6px !important; }
  }
`;
/**
 * OTP verification email — HTML version.
 */
export const getOtpHtml = ({ email, otp, expiresInMinutes = 5 }) => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>${APP_NAME} Verification Code</title>
<style>${baseStyles}</style>
</head>
<body>
<table role="presentation" class="wrapper" width="100%" border="0" cellspacing="0" cellpadding="0">
<tr>
<td align="center" class="p-24">
<table role="presentation" class="container" border="0" cellspacing="0" cellpadding="0">
<tr>
<td class="header">
<span class="brand">${APP_NAME}</span>
</td>
</tr>
<tr>
<td class="p-32">
<h1 class="title">Verify your email</h1>
<p class="text">
Use the verification code below to complete your sign-in to <strong>${APP_NAME}</strong> as <strong>${email}</strong>.
</p>
<table role="presentation" class="otp-wrap" border="0" cellspacing="0" cellpadding="0">
<tr>
<td align="center">
<div class="otp">${otp}</div>
</td>
</tr>
</table>
<p class="muted">This code will expire in <strong>${expiresInMinutes} minutes</strong>.</p>
<p class="muted">If you didn't request this, you can safely ignore this email.</p>
</td>
</tr>
<tr>
<td class="footer">
© ${YEAR} ${APP_NAME}. All rights reserved.
</td>
</tr>
<tr>
<td height="16" aria-hidden="true"></td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
};
/**
 * OTP verification email — plain-text fallback.
 * Nodemailer/mail clients that block HTML (or spam filters) fall back to this.
 */
export const getOtpText = ({ email, otp, expiresInMinutes = 5 }) => {
    return `Verify your email - ${email}

Your ${APP_NAME} verification code is: ${otp}

This code will expire in ${expiresInMinutes} minutes.
If you didn't request this, you can safely ignore this email.

© ${YEAR} ${APP_NAME}`;
};
/**
 * Account verification (magic link) email — HTML version.
 */
export const getVerifyEmailHtml = ({ email, token }) => {
    const verifyUrl = `${FRONTEND_URL.replace(/\/+$/, "")}/token/${encodeURIComponent(token)}`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>${APP_NAME} Verify Your Account</title>
<style>${baseStyles}</style>
</head>
<body>
<table role="presentation" class="wrapper" width="100%" border="0" cellspacing="0" cellpadding="0">
<tr>
<td align="center" class="p-24">
<table role="presentation" class="container" border="0" cellspacing="0" cellpadding="0">
<tr>
<td class="header">
<span class="brand">${APP_NAME}</span>
</td>
</tr>
<tr>
<td class="p-32">
<h1 class="title">Verify your account</h1>
<p class="text">
Thanks for registering with ${APP_NAME} as <strong>${email}</strong>. Click the button below to verify your account.
</p>
<table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 16px 0 20px 0;">
<tr>
<td align="center">
<a class="btn" href="${verifyUrl}" target="_blank" rel="noopener">Verify account</a>
</td>
</tr>
</table>
<p class="muted">If the button doesn't work, copy and paste this link into your browser:</p>
<p class="muted"><a class="link" href="${verifyUrl}" target="_blank" rel="noopener">${verifyUrl}</a></p>
<p class="muted">If this wasn't you, you can safely ignore this email.</p>
</td>
</tr>
<tr>
<td class="footer">
© ${YEAR} ${APP_NAME}. All rights reserved.
</td>
</tr>
<tr>
<td height="16" aria-hidden="true"></td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
};
/**
 * Account verification (magic link) email — plain-text fallback.
 */
export const getVerifyEmailText = ({ email, token }) => {
    const verifyUrl = `${FRONTEND_URL.replace(/\/+$/, "")}/token/${encodeURIComponent(token)}`;
    return `Verify your account - ${email}

Thanks for registering with ${APP_NAME}. Verify your account using the link below:
${verifyUrl}

If this wasn't you, you can safely ignore this email.

© ${YEAR} ${APP_NAME}`;
};
export const getResetPasswordHtml = ({ email, token }) => {
    const resetUrl = `${FRONTEND_URL.replace(/\/+$/, "")}/reset-password/${encodeURIComponent(token)}`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>${APP_NAME} Reset Your Password</title>
<style>${baseStyles}</style>
</head>
<body>
<table role="presentation" class="wrapper" width="100%" border="0" cellspacing="0" cellpadding="0">
<tr>
<td align="center" class="p-24">
<table role="presentation" class="container" border="0" cellspacing="0" cellpadding="0">
<tr>
<td class="header">
<span class="brand">${APP_NAME}</span>
</td>
</tr>
<tr>
<td class="p-32">
<h1 class="title">Reset your password</h1>
<p class="text">
We received a request to reset the password for <strong>${email}</strong>. Click the button below to continue.
</p>
<table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 16px 0 20px 0;">
<tr>
<td align="center">
<a class="btn" href="${resetUrl}" target="_blank" rel="noopener">Reset password</a>
</td>
</tr>
</table>
<p class="muted">If the button doesn't work, copy and paste this link into your browser:</p>
<p class="muted"><a class="link" href="${resetUrl}" target="_blank" rel="noopener">${resetUrl}</a></p>
<p class="muted">If you didn't request this, you can safely ignore this email.</p>
</td>
</tr>
<tr>
<td class="footer">
© ${YEAR} ${APP_NAME}. All rights reserved.
</td>
</tr>
<tr>
<td height="16" aria-hidden="true"></td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
};
export const getResetPasswordText = ({ email, token }) => {
    const resetUrl = `${FRONTEND_URL.replace(/\/+$/, "")}/reset-password/${encodeURIComponent(token)}`;
    return `Reset your password - ${email}

We received a request to reset your ${APP_NAME} password. Use the link below to continue:
${resetUrl}

If you didn't request this, you can safely ignore this email.

© ${YEAR} ${APP_NAME}`;
};
/* ------------------------------------------------------------------ */
/*  Nodemailer wiring                                                  */
/* ------------------------------------------------------------------ */
/**
 * Configure this once (e.g. in a mailer.ts) and import `transporter`
 * wherever you need to send mail. Using a pooled transport avoids
 * reconnecting on every send.
 */
export const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true", // true for port 465, false for 587/25
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    pool: true,
});
/**
 * Sends the OTP email. Includes both html and text so spam filters
 * and text-only clients get a sane fallback.
 */
export const sendOtpEmail = async ({ email, otp, expiresInMinutes = 5 }) => {
    return transporter.sendMail({
        from: process.env.MAIL_FROM || `"${APP_NAME}" <no-reply@example.com>`,
        to: email,
        subject: `${otp} is your ${APP_NAME} verification code`,
        html: getOtpHtml({ email, otp, expiresInMinutes }),
        text: getOtpText({ email, otp, expiresInMinutes }),
    });
};
/**
 * Sends the account verification (magic link) email.
 */
export const sendVerifyEmail = async ({ email, token }) => {
    return transporter.sendMail({
        from: process.env.MAIL_FROM || `"${APP_NAME}" <no-reply@example.com>`,
        to: email,
        subject: `Verify your ${APP_NAME} account`,
        html: getVerifyEmailHtml({ email, token }),
        text: getVerifyEmailText({ email, token }),
    });
};
export const sendResetPasswordEmail = async ({ email, token }) => {
    return transporter.sendMail({
        from: process.env.MAIL_FROM || `"${APP_NAME}" <no-reply@example.com>`,
        to: email,
        subject: `Reset your ${APP_NAME} password`,
        html: getResetPasswordHtml({ email, token }),
        text: getResetPasswordText({ email, token }),
    });
};
export const verifyEmail = asyncTryCatchHandler(async (req, res) => {
    const { token } = req.params;
    if (!token) {
        return res.status(400).json({
            success: false,
            message: "Verification token is required",
        });
    }
    const verifyKey = `verify:${token}`;
    const userDataJSON = await redisClient.get(verifyKey);
    if (!userDataJSON) {
        return res.status(400).json({
            success: false,
            message: "Verification token is not valid",
        });
    }
    const userData = JSON.parse(userDataJSON);
    const { firstName, lastName, email, password } = userData;
    if (!email) {
        return res.status(400).json({
            success: false,
            message: "Invalid, expired, or already used verification link",
        });
    }
    const user = await UserModel.findOne({ email });
    if (user) {
        return res.status(409).json({
            success: false,
            message: "Account already exists for this email",
        });
    }
    const newUser = await UserModel.create({
        firstName,
        lastName,
        email,
        password,
    });
    const userId = newUser._id.toString();
    req.session.userId = userId;
    req.session.role = newUser.role;
    req.session.createdAt = Date.now();
    await revokeUserSessions(userId);
    await new Promise((resolve, reject) => {
        req.session.save?.((err) => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
    if (req.sessionID) {
        await registerSession(userId, req.sessionID);
    }
    const { accessToken, refreshToken } = await generateToken({
        id: userId,
        firstName,
        lastName,
        email,
    }, req.sessionID ?? undefined);
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 15 * 60 * 1000,
    });
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    await redisClient.setEx(`user:${userId}`, 15 * 60, JSON.stringify({
        _id: userId,
        firstName,
        lastName,
        email,
        role: newUser.role,
    }));
    await redisClient.del(verifyKey);
    await redisClient.del(`verify:email:${email}`);
    return res.status(200).json({
        success: true,
        message: "Email verified successfully. Your account has been created successfully.",
    });
});
export const verifyOTP = async (req, response, next) => {
    const request = req;
    const { email, otp } = request.body;
    if (!email || !otp) {
        return response.status(400).json({
            message: "Please Provide all the details"
        });
    }
    const otpKey = `otp:${email}`;
    const otpInString = await redisClient.get(otpKey);
    if (!otpInString) {
        return response.status(400).json({
            message: "OTP has been expired or is invalid"
        });
    }
    const storedOtp = JSON.parse(otpInString);
    if (storedOtp !== otp) {
        return response.status(400).json({
            message: "OTP has been expired or is invalid"
        });
    }
    await redisClient.del(otpKey);
    const user = await UserModel.findOne({ email }).select("-password");
    if (!user) {
        return response.status(400).json({
            message: "No User Found with given Details"
        });
    }
    const userId = user._id.toString();
    request.session.userId = userId;
    request.session.role = user.role;
    request.session.createdAt = Date.now();
    await revokeUserSessions(userId);
    await new Promise((resolve, reject) => {
        request.session.save?.((err) => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
    if (request.sessionID) {
        await registerSession(userId, request.sessionID);
    }
    const { refreshToken, accessToken } = await generateToken({
        firstName: user.firstName, lastName: user.lastName, email: user.email, id: user._id.toString()
    }, request.sessionID ?? undefined);
    const csrfToken = generateCSRFToken(userId, response);
    response.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    response.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 15 * 60 * 1000,
    });
    response.cookie("csrfToken", csrfToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
        maxAge: 15 * 60 * 1000,
    });
    return response.status(200).json({
        message: "Logged In Succesfully"
    });
};
//# sourceMappingURL=sendMail.config.js.map