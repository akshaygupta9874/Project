import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { redisClient } from "../index.js";
import { IUser } from "../models/user.model.js";
import mongoose from "mongoose";
import { Response } from "express";


export interface TokenPayload extends JwtPayload {
  firstName : string,
  lastName : string,
  email : string ,
  id : string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds, useful for the client
}

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET as string;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET as string;

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "7d";

const REFRESH_TOKEN_TTL_SECONDS = Number(process.env.REFRESH_TOKEN_TTL_SECONDS) || 7*24*60*60
const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS) || 15*60

export const REFRESH_TOKEN_REDIS_KEY_PREFIX = "refresh-token";
export const ACCESS_TOKEN_REDIS_KEY_PREFIX = "access-token";

export const getRefreshTokenRedisKey = (userId: string) => `${REFRESH_TOKEN_REDIS_KEY_PREFIX}:${userId}`;
export const getAccessTokenRedisKey = (userId: string) => `${ACCESS_TOKEN_REDIS_KEY_PREFIX}:${userId}`;


if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
  // Fail fast at startup rather than silently signing with `undefined`
  throw new Error("JWT secrets are not configured in environment variables");
}

export async function generateToken(payload: TokenPayload): Promise<AuthTokens> {
  const accessOptions: SignOptions = {
    expiresIn: ACCESS_TOKEN_TTL,
    subject: payload.id,
  };

  const refreshOptions: SignOptions = {
    expiresIn: REFRESH_TOKEN_TTL,
    subject: payload.id,
  };

  const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET, accessOptions);

  // Keep refresh token payload minimal — just enough to re-derive identity
  const refreshToken = jwt.sign(payload,REFRESH_TOKEN_SECRET,refreshOptions); 

  await redisClient.setEx(getRefreshTokenRedisKey(payload.id), REFRESH_TOKEN_TTL_SECONDS, refreshToken)

  await redisClient.setEx(getAccessTokenRedisKey(payload.id), ACCESS_TOKEN_TTL_SECONDS, accessToken)

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  };
}

export const verifyRefreshToken = async (refreshToken: string) => {
    try {
        const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET as string;
        const decodedRefreshToken = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as JwtPayload
        if (!decodedRefreshToken) {
            return null
        }
        const storedRefreshToken = await redisClient.get(getRefreshTokenRedisKey(decodedRefreshToken.id))
        if (storedRefreshToken !== refreshToken) {
            return null
        }
        return decodedRefreshToken.id;
    } catch (err) {
        return null
    }
}

export const generateAccessToken = async (id : string,response : Response)=>{
    const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET as string;
    const accessToken = jwt.sign({id},ACCESS_TOKEN_SECRET,{
        expiresIn : "15m"
    })
    await redisClient.setEx(getAccessTokenRedisKey(id), ACCESS_TOKEN_TTL_SECONDS, accessToken)
    response.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 15 * 60 * 1000,
    });
}

export const revokeRefreshToken = async (userId: string): Promise<void> => {
    if (!userId) {
        throw new Error("revokeRefreshToken: userId is required");
    }

    const refreshTokenKey = getRefreshTokenRedisKey(userId);

    const deletedCount = await redisClient.del(refreshTokenKey);

    if (deletedCount === 0) {
        // Not necessarily an error — token may have already expired
        // or been revoked. Log for visibility rather than throwing.
        console.warn(`revokeRefreshToken: no refresh token found for user ${userId}`);
    }
};