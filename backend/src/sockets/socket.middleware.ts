// src/sockets/socket.middleware.ts
import { DriverModel } from "../models/driver.model.js";
import type { IncomingMessage } from "http";
import jwt, { JwtPayload } from "jsonwebtoken";

import type {
    AuthenticatedSocket,
    AuthenticatedSocketUser,
} from "./types.js";

import { UserRole } from "../models/user.model.js";

interface AccessTokenPayload extends JwtPayload {
    userId: string;
    role: UserRole;
    sessionId: string;
    jti? : string;
}

function extractAccessToken(request: IncomingMessage): string {
    const authorization = request.headers.authorization;

    if (!authorization) {
        throw new Error("Missing Authorization header.");
    }

    if (!authorization.startsWith("Bearer ")) {
        throw new Error("Invalid Authorization header.");
    }

    return authorization.slice(7);
}

export async function authenticateSocket(
    ws: AuthenticatedSocket,
    request: IncomingMessage
): Promise<void> {

    const token = extractAccessToken(request);

    const payload = jwt.verify(
        token,
        process.env.ACCESS_TOKEN_PUBLIC_KEY!
    ) as AccessTokenPayload;

    const user: AuthenticatedSocketUser = {
        userId: payload.userId,
        role: payload.role,
        sessionId: payload.sessionId,
        jti : payload.jti
    };

    if (payload.role === UserRole.DRIVER) {

        const driver = await DriverModel.findOne({
            user: payload.userId,
        }).select("_id");

        if (!driver) {
            throw new Error("Driver profile not found.");
        }

        user.driverId = driver.id;
    }

    ws.user = user;
}