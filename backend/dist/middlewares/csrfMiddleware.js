import crypto from "crypto";
import { redisClient } from "../index.js";
export const generateCSRFToken = async (userID, response) => {
    const csrfToken = crypto.randomBytes(32).toString("hex");
    const csrfKey = `csrf:${userID}`;
    await redisClient.setEx(csrfKey, 3600, csrfToken);
    response.cookie("csrfToken", csrfToken, {
        httpOnly: false,
        secure: true,
        sameSite: "none",
        maxAge: 60 * 60 * 1000
    });
    return csrfToken;
};
export const verifyCsrfToken = async (request, response, next) => {
    const authRequest = request;
    try {
        if (authRequest.method == "GET") {
            return next();
        }
        const userId = authRequest.userId;
        if (!userId) {
            return response.status(403).json({
                message: "user not found /not authenticated"
            });
        }
        const clientToken = authRequest.headers["x-csrf-token"] || authRequest.headers["x-xsrf-token"] || authRequest.headers["csrf-token"];
        if (!clientToken) {
            return response.status(403).json({
                message: "CSRF token missing",
                code: "CSRF_TOKEN_MISSING"
            });
        }
        const csrfKey = `csrf:${userId}`;
        const storedCSRFToken = await redisClient.get(csrfKey);
        if (!storedCSRFToken) {
            return response.status(403).json({
                message: "CSRF Token expired",
                code: "CSRF_TOKEN_EXPIRED"
            });
        }
        if (clientToken != storedCSRFToken) {
            return response.status(403).json({
                message: "CSRF Token INVALID",
                code: "CSRF_TOKEN_INVALID"
            });
        }
        next();
    }
    catch (err) {
        console.log("CSRF verification failed " + err);
        return response.status(500).json({
            message: "csrf token verification failed",
            code: "CSRF_VERIFY_FAILED"
        });
    }
};
export const revokeCSRFToken = async (userId) => {
    const csrfKey = `csrf:${userId}`;
    await redisClient.del(csrfKey);
};
export const refreshCSRFToken = async (userId, response) => {
    await revokeCSRFToken(userId);
    return await generateCSRFToken(userId, response);
};
//# sourceMappingURL=csrfMiddleware.js.map