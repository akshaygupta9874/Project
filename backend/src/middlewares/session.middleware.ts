import crypto from "crypto";
import { Request, Response, NextFunction, RequestHandler } from "express";
import { redisClient } from "../redis/client.js";
import { getRefreshTokenRedisKey } from "../utils/generateToken.js";

type UserRole = string;

interface SessionMethods {
  save?(): Promise<void>;
  destroy?(): Promise<void>;
  regenerate?(): Promise<void>;
}

export interface SessionData extends SessionMethods {
  userId: string;
  role: UserRole;
  createdAt: number;
}

export interface SessionRequest extends Request {
  sessionID: string | null;
  session: SessionData;
}


const SESSION_TTL = 60 * 60 * 24 * 7;

export const getUserSessionsKey = (userId: string) => `user-sessions:${userId}`;

export const registerSession = async (userId: string, sessionId: string) => {
  const sessionsKey = getUserSessionsKey(userId);
  await redisClient.sAdd(sessionsKey, sessionId);
  await redisClient.expire(sessionsKey, SESSION_TTL);
};

export const revokeUserSessions = async (userId: string) => {
  const sessionsKey = getUserSessionsKey(userId);
  const sessionIds = await redisClient.sMembers(sessionsKey);

  for (const sessionId of sessionIds) {
    await redisClient.del(`session:${sessionId}`);
    await redisClient.del(getRefreshTokenRedisKey(userId, sessionId));
  }

  await redisClient.del(sessionsKey);
};

export const removeSessionFromUser = async (userId: string, sessionId: string) => {
  const sessionsKey = getUserSessionsKey(userId);
  await redisClient.sRem(sessionsKey, sessionId);
  await redisClient.del(`session:${sessionId}`);
  await redisClient.del(getRefreshTokenRedisKey(userId, sessionId));
};

const generateSessionId = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

export const sessionMiddleware: RequestHandler = async (
  req: Request,
  response: Response,
  next: NextFunction
) => {
  const request = req as SessionRequest;
  let sessionId: string | null = request.cookies?.["sessionId"] ?? null;
  let session: SessionData = {
    userId: "",
    role: "",
    createdAt: 0
  };

  if (sessionId) {
    try {
      const rawSession = await redisClient.get(`session:${sessionId}`);

      if (rawSession) {
        session = JSON.parse(rawSession);
      } else {
        sessionId = null;
      }
    } catch {
      sessionId = null;
    }
  }

  request.sessionID = sessionId;
  request.session = session;

  request.session.save = async function (): Promise<void> {
    if (!request.sessionID) {
      request.sessionID = generateSessionId();
    }

    if (!request.session.createdAt) {
      request.session.createdAt = Date.now();
    }

    await redisClient.set(
      `session:${request.sessionID}`,
      JSON.stringify({
        userId: request.session.userId,
        role: request.session.role,
        createdAt: request.session.createdAt,
      }),
      {
        EX: SESSION_TTL,
      }
    );

    response.cookie("sessionId", request.sessionID, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: SESSION_TTL * 1000,
    });
  };

  request.session.destroy = async function (): Promise<void> {
    if (request.sessionID) {
      await redisClient.del(`session:${request.sessionID}`);
    }

    response.clearCookie("sessionId");

    if (request.session.userId && request.sessionID) {
      await removeSessionFromUser(request.session.userId, request.sessionID);
    }

    request.sessionID = null;
    request.session = {} as SessionData;
  };

  request.session.regenerate = async function (): Promise<void> {
    if (request.sessionID) {
      await redisClient.del(`session:${request.sessionID}`);
    }

    request.sessionID = generateSessionId();

    await redisClient.set(
      `session:${request.sessionID}`,
      JSON.stringify({
        userId: request.session.userId,
        role: request.session.role,
        createdAt: Date.now(),
      }),
      {
        EX: SESSION_TTL,
      }
    );

    response.cookie("sessionId", request.sessionID, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: SESSION_TTL * 1000,
    });
  };

  next();
};