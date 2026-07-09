import jwt from "jsonwebtoken";
import { redisClient } from "../index.js";
import UserModel from "../models/user.model.js";
import { getAccessTokenRedisKey } from "../utils/generateToken.js";
import { getUserSessionsKey } from "./session.middleware.js";
const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET;
export async function authMiddleware(request, response, next) {
    const authRequest = request;
    const token = authRequest.cookies?.accessToken || authRequest.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) {
        return response.status(401).json({
            message: "Unauthorized Access"
        });
    }
    try {
        if (!ACCESS_TOKEN_SECRET) {
            throw new Error("JWT_SECRET missing");
        }
        const decodedData = jwt.verify(token, ACCESS_TOKEN_SECRET);
        if (!decodedData.id || decodedData.type !== "access") {
            return response.status(401).json({
                message: "Invalid token"
            });
        }
        const activeSessionId = decodedData.sessionId ?? authRequest.sessionID ?? null;
        if (activeSessionId && authRequest.sessionID && authRequest.sessionID !== activeSessionId) {
            response.clearCookie("accessToken");
            response.clearCookie("refreshToken");
            return response.status(401).json({
                message: "Unauthorized Access"
            });
        }
        const storedAccessToken = await redisClient.get(getAccessTokenRedisKey(decodedData.id, activeSessionId ?? undefined));
        if (!storedAccessToken || storedAccessToken !== token) {
            response.clearCookie("accessToken");
            response.clearCookie("refreshToken");
            return response.status(401).json({
                message: "Unauthorized Access"
            });
        }
        if (activeSessionId) {
            const storedSession = await redisClient.get(`session:${activeSessionId}`);
            if (!storedSession) {
                response.clearCookie("accessToken");
                response.clearCookie("refreshToken");
                return response.status(401).json({ message: "Unauthorized Access" });
            }
            const activeSessionIds = await redisClient.sMembers(getUserSessionsKey(decodedData.id));
            if (!activeSessionIds.includes(activeSessionId)) {
                response.clearCookie("accessToken");
                response.clearCookie("refreshToken");
                return response.status(401).json({ message: "Unauthorized Access" });
            }
            const parsedSession = JSON.parse(storedSession);
            if (parsedSession.userId && parsedSession.userId !== decodedData.id) {
                response.clearCookie("accessToken");
                response.clearCookie("refreshToken");
                return response.status(401).json({ message: "Unauthorized Access" });
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
        }
        else {
            authRequest.userId = JSON.parse(cachedUser)._id;
        }
        authRequest.session.userId = decodedData.id;
        authRequest.session.createdAt ??= Date.now();
        return next();
    }
    catch {
        response.clearCookie("accessToken");
        response.clearCookie("refreshToken");
        return response.status(401).json({
            message: "Unauthorized Access"
        });
    }
}
//# sourceMappingURL=isAuthenticated.js.map