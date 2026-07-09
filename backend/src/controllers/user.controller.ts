import { Request, Response } from "express";
import asyncTryCatchHandler from "../middlewares/TryCatch.js";
import { UserLoginSchema, UserRegistrationSchema } from "../zodSchemas/user.schema.js";
import UserModel from "../models/user.model.js";
import { redisClient } from "../index.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendOtpEmail, sendVerifyEmail } from "../config/sendMail.config.js";
import { AuthenticatedRequest } from "../middlewares/isAuthenticated.js";
import { generateAccessToken, getAccessTokenRedisKey, getRefreshTokenRedisKey, revokeRefreshToken, rotateRefreshToken, verifyRefreshToken } from "../utils/generateToken.js";

export const userRegistrationController = asyncTryCatchHandler(
    async (request: Request, response: Response) => {
        const validatedData = UserRegistrationSchema.safeParse(request.body);
        if (!validatedData.success) {
            return response.status(400).json({
                message: "Data Validation Error !!"
            })
        }
        const { firstName, lastName, email, password } = validatedData.data;

        const rateLimitKey = `register-rate-limit:${request.ip}:${email}`;

        if (await redisClient.get(rateLimitKey)) {
            return response.status(429).json(
                {
                    message: "Too many Requests Please Try After Sometime"
                }
            )
        }

        const existingUser = await UserModel.findOne({
            email: email
        })

        if (existingUser) {
            return response.status(400).json(
                {
                    message: "Email Already Registered !!"
                }
            )
        }


        const hashedPassword = await bcrypt.hash(password, 12);
        const verifyToken = crypto.randomBytes(32).toString("hex");
        const verifyKey = `verify:${verifyToken}`

        const dataToStore = JSON.stringify({
            firstName,
            lastName,
            email,
            password: hashedPassword
        })

        await redisClient.set(
            verifyKey,
            dataToStore,
            {
                EX: 300
            }
        )

        await sendVerifyEmail({ email: email, token: verifyToken });

        await redisClient.set(rateLimitKey, "true", { EX: 60 })

        response.status(200).json({
            message: "If your email is correct you have recieved a verification link , it will be valid for next 5 minutes"
        })
    }
)




export const userLoginController = asyncTryCatchHandler(
    async (request: Request, response: Response) => {
        const validatedData = UserLoginSchema.safeParse(request.body);
        if (!validatedData.success) {
            return response.status(400).json({
                message: "Data Validation Error !!"
            })
        }
        const { email, password } = validatedData.data;

        const rateLimitKey = `login-rate-limit:${request.ip}:${email}`;

        if (await redisClient.get(rateLimitKey)) {
            return response.status(429).json(
                {
                    message: "Too many Requests Please Try After Sometime"
                }
            )
        }

        const userFound = await UserModel.findOne({
            email: email
        }).select("+password")

        if (!userFound) {
            return response.status(400).json(
                {
                    message: "Invalid Credendtials!!"
                }
            )
        }
        const isPasswordMatched = await userFound.comparePassword(password);

        if (!isPasswordMatched) {
            return response.status(400).json(
                {
                    message: "Invalid Credendtials!!"
                }
            )
        }

        const otp = crypto.randomInt(100000, 1000000).toString();
        const otpJSON = JSON.stringify(otp)
        const otpKey = `otp:${email}`
        await redisClient.set(otpKey, otpJSON, { EX: 300 })

        await sendOtpEmail({ email, otp, expiresInMinutes: 5 })

        await redisClient.set(rateLimitKey, "true", { EX: 60 })

        response.status(200).json({
            message: "If your email is correct you have recieved a otp in your mail , it will be valid for next 5 minutes"
        })
    }
)

export const myProfile = asyncTryCatchHandler(async (request: AuthenticatedRequest, response: Response) => {
    const userId = request.userId

    const user = await redisClient.get(`user:${userId}`) as string

    const parsedUser = JSON.parse(user)

    return response.json(parsedUser)

}

)
export const refreshToken = asyncTryCatchHandler(async (request: Request, response: Response) => {
    const refreshToken = request.cookies.refreshToken;
    if (!refreshToken) {
        return response.status(403).json(
            {
                message: "please provide refresh token"
            }
        )
    }

    const userId = await verifyRefreshToken(refreshToken);
    if (!userId) {
        return response.status(401).json(
            {
                message: "Invalid refresh token"
            }
        )
    }

    await generateAccessToken(userId, response)

    response.status(200).json(
        {
            message: "Token Refreshed"
        }
    )
})


export const userLogoutController = asyncTryCatchHandler(
    async (request: AuthenticatedRequest, response: Response) => {
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
    }
);