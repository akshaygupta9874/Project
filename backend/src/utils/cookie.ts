import type { CookieOptions } from "express";

const isProduction = process.env.NODE_ENV === "production";

export const getCookieOptions = (overrides: CookieOptions = {}): CookieOptions => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  ...overrides,
});

export const getCsrfCookieOptions = (overrides: CookieOptions = {}): CookieOptions => ({
  ...getCookieOptions({
    httpOnly: false,
    ...overrides,
  }),
});
