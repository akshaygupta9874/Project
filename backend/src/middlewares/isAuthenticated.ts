import { NextFunction, Request, Response } from "express"
import jwt from "jsonwebtoken"
import { redisClient } from "../index.js";
import type { JwtPayload } from "jsonwebtoken";
import UserModel from "../models/user.model.js";
import { getAccessTokenRedisKey } from "../utils/generateToken.js";


export interface AuthenticatedRequest extends Request {
    userId?: string;
}

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET as string;

interface AuthPayload extends JwtPayload {
    id: string;
}

export async function authMiddleware(
    request: AuthenticatedRequest,
    response: Response,
    next: NextFunction
) {
    const token = request.cookies?.accessToken || request.headers.authorization?.replace(/^Bearer\s+/i, "");

    if (!token) {
        return response.status(401).json({
            message: "Unauthorized Access"
        });
    }

    try {

        if (!ACCESS_TOKEN_SECRET) {
            throw new Error("JWT_SECRET missing");
        }

        const decodedData = jwt.verify(
            token,
            ACCESS_TOKEN_SECRET
        ) as AuthPayload

        if (!decodedData.id) {
            return response.status(401).json({
                message: "Invalid token"
            });
        }

        const storedAccessToken = await redisClient.get(getAccessTokenRedisKey(decodedData.id));

        if (!storedAccessToken || storedAccessToken !== token) {
            response.clearCookie("accessToken");
            response.clearCookie("refreshToken");
            return response.status(401).json({
                message: "Unauthorized Access"
            });
        }

        const cachedUser = await redisClient.get(`user:${decodedData.id}`);

        if (!cachedUser) {
            const user = await UserModel.findById(decodedData.id).select("-password");

            if (!user) {
                return response.status(404).json({ message: "User no longer exists" });
            }

            await redisClient.setEx(`user:${decodedData.id}`, 15*60, JSON.stringify(user));

            request.userId = (user._id).toString();
        } else {
            request.userId = JSON.parse(cachedUser)._id;
        }
        return next();

    } catch {
        response.clearCookie("accessToken");
        response.clearCookie("refreshToken");

        return response.status(401).json({
            message: "Unauthorized Access"
        });
    }
}
