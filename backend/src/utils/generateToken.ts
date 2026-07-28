import crypto from "crypto";
import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { redisClient } from "../redis/client.js";
import { Response } from "express";
import { revokeCSRFToken } from "../middlewares/csrfMiddleware.js";
import { getCookieOptions } from "./cookie.js";

export interface TokenPayload extends JwtPayload {
  firstName: string;
  lastName: string;
  email: string;
  id: string;
  type?: "access" | "refresh";
  sessionId?: string;
  jti?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET as string;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET as string;

const ACCESS_TOKEN_TTL = "1d";
const REFRESH_TOKEN_TTL = "7d";

const REFRESH_TOKEN_TTL_SECONDS = Number(process.env.REFRESH_TOKEN_TTL_SECONDS) || 7 * 24 * 60 * 60;
const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS) || 24*60* 60;

export const getRefreshTokenRedisKey = (userId: string, sessionId?: string) => `refresh-token:${userId}${sessionId ? `:${sessionId}` : ""}`;

if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
  throw new Error("JWT secrets are not configured in environment variables");
}

export async function generateToken(payload: TokenPayload, sessionId?: string): Promise<AuthTokens> {
  const effectiveSessionId = sessionId ?? payload.sessionId ?? crypto.randomUUID();
  const accessPayload: TokenPayload = {
    ...payload,
    id: payload.id,
    sessionId: effectiveSessionId,
    type: "access",
  };
  const refreshPayload: TokenPayload = {
    ...payload,
    id: payload.id,
    sessionId: effectiveSessionId,
    type: "refresh",
    jti: payload.jti ?? crypto.randomUUID(),
  };

  const accessOptions: SignOptions = {
    expiresIn: ACCESS_TOKEN_TTL,
    subject: payload.id,
  };

  const refreshOptions: SignOptions = {
    expiresIn: REFRESH_TOKEN_TTL,
    subject: payload.id,
  };

  const accessToken = jwt.sign(accessPayload, ACCESS_TOKEN_SECRET, accessOptions);
  const refreshToken = jwt.sign(refreshPayload, REFRESH_TOKEN_SECRET, refreshOptions);

  await redisClient.setEx(getRefreshTokenRedisKey(payload.id, effectiveSessionId), REFRESH_TOKEN_TTL_SECONDS, refreshToken);

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  };
}

export const verifyRefreshToken = async (refreshToken: string, sessionId: string) => {
  try {
    const decodedRefreshToken = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as JwtPayload & TokenPayload;
    if (!decodedRefreshToken || decodedRefreshToken.type !== "refresh") {
      return null;
    }

    const activeSessionId = sessionId ?? decodedRefreshToken.sessionId;
    const storedRefreshToken = await redisClient.get(getRefreshTokenRedisKey(decodedRefreshToken.id, activeSessionId));

    if (storedRefreshToken !== refreshToken) {
      return null;
    }

    return decodedRefreshToken.id;
  } catch {
    return null;
  }
};

export const generateAccessToken = async (id: string, response: Response, sessionId: string) => {
  const accessToken = jwt.sign({ id, type: "access", sessionId: sessionId }, ACCESS_TOKEN_SECRET, {
    expiresIn: "1d",
  });

  return {
    accessToken,
    expiresIn: 24*60*60,
    sessionId: sessionId,
  };
};

export const rotateRefreshToken = async (userId: string, response: Response, sessionId: string) => {
  const newRefreshToken = jwt.sign({ id: userId, type: "refresh", sessionId, jti: crypto.randomUUID() }, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL,
    subject: userId,
  });

  await redisClient.setEx(getRefreshTokenRedisKey(userId, sessionId), REFRESH_TOKEN_TTL_SECONDS, newRefreshToken);

  response.cookie("refreshToken", newRefreshToken, getCookieOptions({
    maxAge: 7 * 24 * 60 * 60 * 1000,
  }));

  return newRefreshToken;
};

export const revokeRefreshToken = async (userId: string, response: Response, sessionId?: string): Promise<void> => {
  if (!userId) {
    throw new Error("revokeRefreshToken: userId is required");
  }
  response.clearCookie("refreshToken",getCookieOptions());
  response.clearCookie("csrfToken",getCookieOptions());
  const refreshTokenKey = getRefreshTokenRedisKey(userId, sessionId);
  await redisClient.del(refreshTokenKey);
  await revokeCSRFToken(userId)
};