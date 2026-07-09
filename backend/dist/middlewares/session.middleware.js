import crypto from "crypto";
import { redisClient } from "../index.js";
import { getAccessTokenRedisKey, getRefreshTokenRedisKey } from "../utils/generateToken.js";
const COOKIE_NAME = "sessionId";
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days
export const getUserSessionsKey = (userId) => `user-sessions:${userId}`;
export const registerSession = async (userId, sessionId) => {
    const sessionsKey = getUserSessionsKey(userId);
    await redisClient.sAdd(sessionsKey, sessionId);
    await redisClient.expire(sessionsKey, SESSION_TTL);
};
export const revokeUserSessions = async (userId) => {
    const sessionsKey = getUserSessionsKey(userId);
    const sessionIds = await redisClient.sMembers(sessionsKey);
    for (const sessionId of sessionIds) {
        await redisClient.del(`session:${sessionId}`);
        await redisClient.del(getAccessTokenRedisKey(userId, sessionId));
        await redisClient.del(getRefreshTokenRedisKey(userId, sessionId));
    }
    await redisClient.del(sessionsKey);
};
export const removeSessionFromUser = async (userId, sessionId) => {
    const sessionsKey = getUserSessionsKey(userId);
    await redisClient.sRem(sessionsKey, sessionId);
    await redisClient.del(`session:${sessionId}`);
    await redisClient.del(getAccessTokenRedisKey(userId, sessionId));
    await redisClient.del(getRefreshTokenRedisKey(userId, sessionId));
};
const generateSessionId = () => {
    return crypto.randomBytes(32).toString("hex");
};
export const sessionMiddleware = async (req, response, next) => {
    const request = req;
    let sessionId = request.cookies?.[COOKIE_NAME] ?? null;
    let session = {};
    if (sessionId) {
        try {
            const rawSession = await redisClient.get(`session:${sessionId}`);
            if (rawSession) {
                session = JSON.parse(rawSession);
            }
            else {
                sessionId = null;
            }
        }
        catch {
            sessionId = null;
        }
    }
    request.sessionID = sessionId;
    request.session = session;
    request.session.save = function (callback) {
        (async () => {
            try {
                if (!request.sessionID) {
                    request.sessionID = generateSessionId();
                }
                if (!request.session.createdAt) {
                    request.session.createdAt = Date.now();
                }
                await redisClient.set(`session:${request.sessionID}`, JSON.stringify({
                    userId: request.session.userId,
                    role: request.session.role,
                    createdAt: request.session.createdAt,
                }), {
                    EX: SESSION_TTL,
                });
                response.cookie(COOKIE_NAME, request.sessionID, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "strict",
                    maxAge: SESSION_TTL * 1000,
                });
                callback?.(null);
            }
            catch (error) {
                callback?.(error);
            }
        })();
    };
    request.session.destroy = function (callback) {
        (async () => {
            try {
                if (request.sessionID) {
                    await redisClient.del(`session:${request.sessionID}`);
                }
                response.clearCookie(COOKIE_NAME);
                if (request.session.userId && request.sessionID) {
                    await removeSessionFromUser(request.session.userId, request.sessionID);
                }
                request.sessionID = null;
                request.session = {};
                callback?.(null);
            }
            catch (error) {
                callback?.(error);
            }
        })();
    };
    request.session.regenerate = function (callback) {
        (async () => {
            try {
                if (request.sessionID) {
                    await redisClient.del(`session:${request.sessionID}`);
                }
                request.sessionID = generateSessionId();
                await redisClient.set(`session:${request.sessionID}`, JSON.stringify({
                    userId: request.session.userId,
                    role: request.session.role,
                    createdAt: Date.now(),
                }), {
                    EX: SESSION_TTL,
                });
                response.cookie(COOKIE_NAME, request.sessionID, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "strict",
                    maxAge: SESSION_TTL * 1000,
                });
                callback?.(null);
            }
            catch (error) {
                callback?.(error);
            }
        })();
    };
    next();
};
//# sourceMappingURL=session.middleware.js.map