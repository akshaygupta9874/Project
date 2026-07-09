import crypto from "crypto";
import jwt from "jsonwebtoken";
import { redisClient } from "../index.js";
const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "7d";
const REFRESH_TOKEN_TTL_SECONDS = Number(process.env.REFRESH_TOKEN_TTL_SECONDS) || 7 * 24 * 60 * 60;
const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS) || 15 * 60;
export const REFRESH_TOKEN_REDIS_KEY_PREFIX = "refresh-token";
export const ACCESS_TOKEN_REDIS_KEY_PREFIX = "access-token";
export const getRefreshTokenRedisKey = (userId, sessionId) => `${REFRESH_TOKEN_REDIS_KEY_PREFIX}:${userId}${sessionId ? `:${sessionId}` : ""}`;
export const getAccessTokenRedisKey = (userId, sessionId) => `${ACCESS_TOKEN_REDIS_KEY_PREFIX}:${userId}${sessionId ? `:${sessionId}` : ""}`;
if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
    throw new Error("JWT secrets are not configured in environment variables");
}
export async function generateToken(payload, sessionId) {
    const effectiveSessionId = sessionId ?? payload.sessionId ?? crypto.randomUUID();
    const accessPayload = {
        ...payload,
        id: payload.id,
        sessionId: effectiveSessionId,
        type: "access",
    };
    const refreshPayload = {
        ...payload,
        id: payload.id,
        sessionId: effectiveSessionId,
        type: "refresh",
        jti: payload.jti ?? crypto.randomUUID(),
    };
    const accessOptions = {
        expiresIn: ACCESS_TOKEN_TTL,
        subject: payload.id,
    };
    const refreshOptions = {
        expiresIn: REFRESH_TOKEN_TTL,
        subject: payload.id,
    };
    const accessToken = jwt.sign(accessPayload, ACCESS_TOKEN_SECRET, accessOptions);
    const refreshToken = jwt.sign(refreshPayload, REFRESH_TOKEN_SECRET, refreshOptions);
    await redisClient.setEx(getRefreshTokenRedisKey(payload.id, effectiveSessionId), REFRESH_TOKEN_TTL_SECONDS, refreshToken);
    await redisClient.setEx(getAccessTokenRedisKey(payload.id, effectiveSessionId), ACCESS_TOKEN_TTL_SECONDS, accessToken);
    return {
        accessToken,
        refreshToken,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    };
}
export const verifyRefreshToken = async (refreshToken, sessionId) => {
    try {
        const decodedRefreshToken = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
        if (!decodedRefreshToken || decodedRefreshToken.type !== "refresh") {
            return null;
        }
        const activeSessionId = sessionId ?? decodedRefreshToken.sessionId;
        const storedRefreshToken = await redisClient.get(getRefreshTokenRedisKey(decodedRefreshToken.id, activeSessionId));
        if (storedRefreshToken !== refreshToken) {
            return null;
        }
        return decodedRefreshToken.id;
    }
    catch {
        return null;
    }
};
export const generateAccessToken = async (id, response, sessionId) => {
    const effectiveSessionId = sessionId ?? crypto.randomUUID();
    const accessToken = jwt.sign({ id, type: "access", sessionId: effectiveSessionId }, ACCESS_TOKEN_SECRET, {
        expiresIn: "15m",
    });
    await redisClient.setEx(getAccessTokenRedisKey(id, effectiveSessionId), ACCESS_TOKEN_TTL_SECONDS, accessToken);
    response.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 15 * 60 * 1000,
    });
    return {
        accessToken,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        sessionId: effectiveSessionId,
    };
};
export const rotateRefreshToken = async (userId, sessionId, response) => {
    const newRefreshToken = jwt.sign({ id: userId, type: "refresh", sessionId, jti: crypto.randomUUID() }, REFRESH_TOKEN_SECRET, {
        expiresIn: REFRESH_TOKEN_TTL,
        subject: userId,
    });
    await redisClient.setEx(getRefreshTokenRedisKey(userId, sessionId), REFRESH_TOKEN_TTL_SECONDS, newRefreshToken);
    response.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return newRefreshToken;
};
export const revokeRefreshToken = async (userId, sessionId) => {
    if (!userId) {
        throw new Error("revokeRefreshToken: userId is required");
    }
    const refreshTokenKey = getRefreshTokenRedisKey(userId, sessionId);
    const accessTokenKey = getAccessTokenRedisKey(userId, sessionId);
    await redisClient.del(refreshTokenKey);
    await redisClient.del(accessTokenKey);
};
//# sourceMappingURL=generateToken.js.map