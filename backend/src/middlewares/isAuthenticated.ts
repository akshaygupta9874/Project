import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { redisClient } from "../index.js";
import type { JwtPayload } from "jsonwebtoken";
import UserModel from "../models/user.model.js";
import { getAccessTokenRedisKey } from "../utils/generateToken.js";
import { getUserSessionsKey, SessionData } from "./session.middleware.js";
import { refreshToken } from "../controllers/user.controller.js";

export interface AuthenticatedRequest extends Request {
    userId?: string;
    sessionID: string | null;
    session: SessionData;
}

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET as string;

interface AuthPayload extends JwtPayload {
    id: string;
    type?: string;
    sessionId?: string;
}

export async function authMiddleware(
    request: Request,
    response: Response,
    next: NextFunction
) {
    const authRequest = request as AuthenticatedRequest;
    const token = authRequest.cookies?.accessToken || authRequest.headers.authorization?.replace(/^Bearer\s+/i, "");

    if (!token) {
        return response.status(401).json({
            message: "You are not authorized to access this resource."
        });
    }
    try {
        if (!ACCESS_TOKEN_SECRET) {
            throw new Error("JWT_SECRET missing");
        }


        const decodedData = jwt.verify(token, ACCESS_TOKEN_SECRET) as AuthPayload;

        if (!decodedData.id || decodedData.type !== "access") {
            return response.status(401).json({
                message: "Your session has expired. Please sign in again."
            });
        }

        const activeSessionId = decodedData.sessionId ?? authRequest.sessionID ?? null;

        if (activeSessionId && authRequest.sessionID && authRequest.sessionID !== activeSessionId) {
            response.clearCookie("accessToken");
            response.clearCookie("refreshToken");
            return response.status(401).json({
                message: "Your session is no longer valid. Please sign in again."
            });
        }

        const storedAccessToken = await redisClient.get(getAccessTokenRedisKey(decodedData.id, activeSessionId ?? undefined));
        

        if (!storedAccessToken || storedAccessToken !== token) {
            response.clearCookie("accessToken");
            response.clearCookie("refreshToken");
            return response.status(401).json({
                message: "Your session is no longer valid. Please sign in again."
            });
        }

        if (activeSessionId) {
            const storedSession = await redisClient.get(`session:${activeSessionId}`);
            if (!storedSession) {
                response.clearCookie("accessToken");
                response.clearCookie("refreshToken");
                return response.status(401).json({ message: "Your session is no longer valid. Please sign in again." });
            }

            const activeSessionIds = await redisClient.sMembers(getUserSessionsKey(decodedData.id));
            if (!activeSessionIds.includes(activeSessionId)) {
                response.clearCookie("accessToken");
                response.clearCookie("refreshToken");
                return response.status(401).json({ message: "Your session is no longer valid. Please sign in again." });
            }

            const parsedSession = JSON.parse(storedSession);
            if (parsedSession.userId && parsedSession.userId !== decodedData.id) {
                response.clearCookie("accessToken");
                response.clearCookie("refreshToken");
                return response.status(401).json({ message: "Your session is no longer valid. Please sign in again." });
            }
        }

        const cachedUser = await redisClient.get(`user:${decodedData.id}`);

        if (!cachedUser) {
            const user = await UserModel.findById(decodedData.id).select("-password");

            if (!user) {
                return response.status(404).json({ message: "User no longer exists" });
            }

            await redisClient.setEx(`user:${decodedData.id}`, 15 * 60, JSON.stringify(user));
            authRequest.userId = user._id.toString();
        } else {
            authRequest.userId = JSON.parse(cachedUser)._id;
        }

        authRequest.session.userId = decodedData.id;
        authRequest.session.createdAt ??= Date.now();

        return next();
    } catch {
        response.clearCookie("accessToken");
        response.clearCookie("refreshToken");

        return response.status(401).json({
            message: "Your session is no longer valid. Please sign in again."
        });
    }
}
