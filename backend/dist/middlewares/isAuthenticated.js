import jwt from "jsonwebtoken";
import { redisClient } from "../index.js";
import UserModel from "../models/user.model.js";
import { getAccessTokenRedisKey } from "../utils/generateToken.js";
const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET;
export async function authMiddleware(request, response, next) {
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
        const decodedData = jwt.verify(token, ACCESS_TOKEN_SECRET);
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
            await redisClient.setEx(`user:${decodedData.id}`, 15 * 60, JSON.stringify(user));
            request.userId = (user._id).toString();
        }
        else {
            request.userId = JSON.parse(cachedUser)._id;
        }
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