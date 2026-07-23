// src/sockets/socket.middleware.ts
import { DriverModel } from "../models/driver.model.js";
import type { IncomingMessage } from "http";
import jwt, { JwtPayload } from "jsonwebtoken";

import type {
    AuthenticatedSocket,
    AuthenticatedSocketUser,
} from "./types.js";
import UserModel, { UserRole } from "../models/user.model.js";
import { TokenPayload } from "../utils/generateToken.js";

interface AccessTokenPayload extends JwtPayload {
    userId: string;
    role: UserRole;
    sessionId: string;
}

function extractAccessToken(request: IncomingMessage): string {
    const authorization = request.headers.authorization;

    if (authorization && authorization.startsWith("Bearer ")) {
        return authorization.slice(7);
    }

    const host = request.headers.host ?? "localhost";
    const url = new URL(request.url ?? "", `http://${host}`);
    const token = url.searchParams.get("token") ?? url.searchParams.get("access_token");

    if (!token) {
        throw new Error("Missing Authorization header or token query parameter.");
    }

    return token.startsWith("Bearer ") ? token.slice(7) : token;
}

export async function authenticateSocket(
    ws: AuthenticatedSocket,
    request: IncomingMessage
): Promise<void> {

    const token = extractAccessToken(request);
    const payload = jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET!
    ) as TokenPayload;

    const USER = await UserModel.findById(payload.id).select("+role");

    const user: AuthenticatedSocketUser = {
        userId: payload.id,
        role: USER!.role,
        sessionId: payload.sessionId!,
        jti : payload.jti
    };

    if (USER!.role === UserRole.DRIVER) {

        const driver = await DriverModel.findOne({
            user: payload.id,
        }).select("_id");

        if (!driver) {
            throw new Error("Driver profile not found.");
        }

        user.driverId = driver._id.toString();
    }

    ws.user = user;
}