# Backend Documentation

This document describes the backend of the project in detail. It is written based on the current implementation and explains how the server is structured, how authentication works, how sessions are handled, how data is stored, and how the major modules interact with each other.

---

## 1. Project Overview

This backend is a Node.js + TypeScript application built with Express. It provides user authentication features, session-based access control, Redis-backed token/session storage, MongoDB persistence, and email-based verification.

### Main goals of this backend
- Register users securely
- Verify accounts via email
- Authenticate users via OTP-based login flow
- Issue access and refresh tokens
- Store sessions in Redis
- Protect routes with authentication middleware
- Support single-active-session behavior across devices
- Provide a clean and modular structure for future expansion

### Core technologies used
- Node.js
- TypeScript
- Express.js
- MongoDB with Mongoose
- Redis
- JWT (jsonwebtoken)
- bcryptjs for password hashing
- Zod for request validation
- Nodemailer for sending emails
- cookie-parser for cookie handling
- CORS, Helmet, express-mongo-sanitize for security hardening

---

## 2. Project Structure

The backend code is organized into clear folders:

```text
backend/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── config/
│   │   ├── db.config.ts
│   │   └── sendMail.config.ts
│   ├── controllers/
│   │   └── user.controller.ts
│   ├── middlewares/
│   │   ├── errorHandler.ts
│   │   ├── isAuthenticated.ts
│   │   ├── session.middleware.ts
│   │   ├── TryCatch.ts
│   │   └── session.middleware.ts
│   ├── models/
│   │   └── user.model.ts
│   ├── routes/
│   │   └── user.route.ts
│   ├── utils/
│   │   └── generateToken.ts
│   ├── zodSchemas/
│   │   └── user.schema.ts
```

### Folder explanation

#### src/index.ts
This is the entry point of the backend application. It:
- creates the Express app
- loads environment variables
- enables CORS
- parses JSON and cookies
- applies security middlewares
- connects to Redis
- connects to MongoDB
- mounts the routes
- starts the server

#### src/config/
Contains environment-specific configuration modules.

- db.config.ts
  - connects the app to MongoDB using Mongoose
  - uses the database name `uber`

- sendMail.config.ts
  - configures Nodemailer transporter
  - contains functions for sending OTP emails and verification emails
  - handles account verification and OTP verification logic

#### src/controllers/
Contains the business logic for the API endpoints.

- user.controller.ts handles:
  - registration
  - login initiation
  - OTP verification
  - profile retrieval
  - token refresh
  - logout

#### src/middlewares/
Contains reusable middleware logic.

- isAuthenticated.ts
  - protects routes by validating access tokens
  - ensures the session is still valid
  - enforces single-session behavior

- session.middleware.ts
  - builds a custom session layer using Redis
  - reads and writes session data
  - manages session cookies
  - tracks active sessions per user
  - revokes old sessions when a new login occurs

- TryCatch.ts
  - wraps async route handlers so errors are passed to Express error middleware

- errorHandler.ts
  - central error response handler for consistent error output

#### src/models/
Contains Mongoose models.

- user.model.ts defines the user schema and password comparison method.

#### src/routes/
Contains route definitions.

- user.route.ts mounts all user authentication routes.

#### src/utils/
Contains helper utilities.

- generateToken.ts creates and validates JWT access/refresh tokens and stores them in Redis.

#### src/zodSchemas/
Contains Zod validation schemas for incoming requests.

- user.schema.ts validates registration and login payloads.

---

## 3. Runtime Environment and Dependencies

This backend expects the following services to be available:
- MongoDB server
- Redis server
- SMTP mail server for sending emails

### Required Node.js version
The project uses modern JavaScript/TypeScript syntax and should run on a recent Node.js version.

### Main packages
- express: web framework
- mongoose: MongoDB ODM
- redis: Redis client
- jsonwebtoken: token signing and verification
- bcryptjs: password hashing
- nodemailer: sending emails
- zod: validation
- cors/helmet/cookie-parser/express-mongo-sanitize: security

---

## 4. Environment Variables

The backend depends on a `.env` file. The code expects the following environment variables:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
FRONTEND_URL=http://localhost:5173
APP_NAME=Authentication App
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
MAIL_FROM=no-reply@example.com
NODE_ENV=development
```

### Notes about these variables
- `MONGODB_URI` is required for MongoDB connection
- `REDIS_URL` is required for Redis connection
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are required for token signing
- `FRONTEND_URL` is used when building verification links in emails
- SMTP variables are required so signup/login emails can be sent

---

## 5. Installation and Running

### Install dependencies
```bash
cd backend
npm install
```

### Start in development mode
```bash
npm run dev
```

### Build the TypeScript project
```bash
npm run build
```

### Start the built app
```bash
npm start
```

### Important startup behavior
On startup the backend will:
1. load environment variables
2. connect to Redis
3. connect to MongoDB
4. mount API routes
5. begin accepting HTTP requests

If Redis or MongoDB is unavailable, the app may fail or exit depending on configuration.

---

## 6. Database Design

### MongoDB
MongoDB stores the user records.

### User model fields
The current user schema contains:
- firstName
- lastName
- email
- password
- role
- timestamps

### User role values
The user model supports:
- USER
- ADMIN

### Notes about the model
- email is unique
- password is stored as a hashed value
- password is excluded from normal retrieval by default
- password comparison is handled via a custom method

---

## 7. Redis Usage

Redis is used heavily for authentication and session management.

### Why Redis is used
Redis allows the backend to:
- store temporary verification data
- store OTP codes for email login verification
- store access/refresh tokens for validation
- track active sessions per user
- revoke sessions instantly when a new login occurs

### Common Redis keys used by the backend
- `verify:<token>` for pending registration verification data
- `otp:<email>` for login OTP values
- `access-token:<userId>` and `refresh-token:<userId>` for JWT storage
- `session:<sessionId>` for stored session payloads
- `user-sessions:<userId>` for active session tracking
- `user:<userId>` for cached user profile data

### Session behavior in Redis
When a user successfully logs in, the backend stores a session record in Redis and registers that session as the current active session for the user. If the user logs in again from another device or browser, all previous sessions are revoked.

---

## 8. Authentication Flow

The backend uses a multi-step authentication flow that combines email verification, OTP verification, JWTs, cookies, and Redis sessions.

### A. Registration flow
1. Client sends registration request with first name, last name, email, password.
2. Request is validated using Zod.
3. Server checks for duplicate email.
4. Password is hashed using bcrypt.
5. A verification token is generated.
6. The registration payload is stored temporarily in Redis for 5 minutes.
7. A verification email is sent to the user.
8. The user must click the verification link to complete signup.

### B. Email verification flow
1. The user visits the verification endpoint with the token.
2. The backend checks Redis for the pending registration data.
3. If valid, a new user is created in MongoDB.
4. The backend creates a fresh session.
5. It revokes old sessions for this user (if any).
6. It issues access and refresh tokens.
7. It stores the tokens in Redis and sets them as HTTP-only cookies.

### C. Login flow
1. Client sends login credentials.
2. The backend validates the request.
3. It checks the email and password.
4. If valid, it generates a one-time password.
5. The OTP is stored in Redis for a short time.
6. The OTP is sent to the user’s email.

### D. OTP verification flow
1. Client submits the email and OTP.
2. The backend checks the stored OTP in Redis.
3. If the OTP is valid, the user is considered authenticated.
4. The backend creates a new session.
5. It revokes all previous sessions for the user.
6. It issues new access/refresh tokens.
7. The tokens are set as cookies.

### E. Refresh flow
1. The client sends a refresh request with the refresh token cookie.
2. The backend verifies the refresh token signature and type.
3. It checks Redis to ensure the refresh token is still valid.
4. If valid, it issues a new access token.
5. It rotates the refresh token and stores the new one.

### F. Logout flow
1. The client calls logout.
2. The backend revokes the stored tokens for the current session.
3. It removes the user profile cache.
4. It removes the session from Redis.
5. It clears the auth cookies.

---

## 9. Session-Based Authentication Design

The backend does not rely only on JWTs. It also uses Redis-backed sessions to provide stronger session control.

### Session model
A session includes:
- session ID
- user ID
- role
- created timestamp

### How sessions are created
A session is created when:
- the user verifies their email
- the user verifies the OTP during login

### How sessions are stored
The session data is stored in Redis under keys like:
- `session:<sessionId>`

The session ID is also stored in an HTTP-only cookie named `sessionId`.

### Why this matters
This allows the backend to:
- know whether a session is still active
- invalidate a session immediately if needed
- enforce the “one active session per user” behavior

### Single-session enforcement
If a user logs in from another device or browser, the previous sessions for that same user are revoked. That means the older device/browser is logged out automatically.

---

## 10. Token Strategy

The backend uses two kinds of tokens:
- access token
- refresh token

### Access token
- Short-lived
- Used for protected route access
- Stored in Redis
- Sent via `accessToken` cookie
- Valid for about 15 minutes

### Refresh token
- Long-lived
- Used to obtain a new access token
- Stored in Redis
- Sent via `refreshToken` cookie
- Valid for 7 days

### Token typing
The token payload includes metadata such as:
- user ID
- session ID
- token type (`access` or `refresh`)
- optional JSON Web Token ID (`jti`)

This makes token validation more explicit and safer.

### Token rotation
When the refresh endpoint is called successfully, the backend issues a new refresh token and replaces the old one. This improves security by reducing token reuse risk.

---

## 11. Protected Routes and Middleware

Routes that require authentication are protected by the `authMiddleware` middleware.

### Current protected routes
- `GET /v1/api/myprofile`
- `POST /v1/api/logout`

### Middleware responsibilities
The authentication middleware:
- reads access token from cookies or Authorization header
- verifies the JWT signature
- ensures the token is an access token, not a refresh token
- checks that the token is still stored in Redis
- checks that the session still exists
- checks that the session is still registered for the user
- loads the user from Redis or MongoDB
- attaches the authenticated user information to the request object

If any of these checks fail, the request is rejected with `401 Unauthorized`.

---

## 12. API Routes

The backend exposes the following routes under the base path `/v1/api`.

### Public routes

#### POST /v1/api/register
Registers a new user.

Request body:
- firstName
- lastName
- email
- password

Behavior:
- validates input
- checks for duplicate email
- stores pending verification data in Redis
- sends verification email

#### POST /v1/api/verify/:token
Completes email verification.

Behavior:
- verifies token from Redis
- creates the user in MongoDB
- creates a session
- issues auth tokens
- sets cookies

#### POST /v1/api/login
Starts the login process.

Request body:
- email
- password

Behavior:
- validates credentials
- creates OTP
- stores OTP in Redis
- sends OTP email

#### POST /v1/api/verify-otp
Completes login with OTP.

Request body:
- email
- otp

Behavior:
- validates OTP
- creates session
- issues auth tokens
- revokes earlier sessions for the same user

### Protected routes

#### GET /v1/api/myprofile
Returns the current authenticated user profile.

#### POST /v1/api/refresh
Refreshes the access token using the refresh token.

#### POST /v1/api/logout
Logs the user out and invalidates the current session.

---

## 13. Request Validation

The backend uses Zod for validating incoming payloads before processing them.

### Registration validation rules
- firstName: minimum 2 characters, maximum 50
- lastName: minimum 2 characters, maximum 50
- email: must be a valid email
- password: minimum 8 characters, must contain uppercase, lowercase, and numbers

### Login validation rules
- email: must be valid
- password: must meet the same strength requirements

If validation fails, the server returns a `400` response with an error message.

---

## 14. Error Handling Strategy

The project uses a custom async wrapper and a global error handler.

### asyncTryCatchHandler
This middleware catches exceptions from async route handlers and forwards them to the Express error middleware.

### errorHandler.ts
This file returns a consistent JSON response for errors.

Example behavior:
- `500` returns `Internal Server Error`
- other statuses return the actual error message

---

## 15. Security Features

The backend includes several important security safeguards:

### Password security
- passwords are hashed using bcryptjs before storage
- plain text passwords are never stored

### Token security
- JWTs are stored in Redis for validation
- auth cookies are `HttpOnly`
- cookies use `SameSite=strict`
- cookies are secured in production mode

### Session security
- sessions are stored in Redis
- session cookies are `HttpOnly`
- old sessions are revoked on new login
- access token validation ensures the session still belongs to the current user

### Request hardening
- CORS is enabled
- Helmet is applied for security headers
- MongoDB sanitizer is enabled to protect against query injection
- JSON request bodies are parsed

### Rate limiting style behavior
The current implementation uses Redis-backed rate limit keys for register and login attempts to reduce abuse.

---

## 16. Email System

The backend sends two main kinds of email:

### OTP email
Used during login.
- contains a short numeric code
- code is valid for 5 minutes
- stored temporarily in Redis

### Verification email
Used during signup.
- contains a magic-link style verification URL
- token is valid for 5 minutes
- stored temporarily in Redis

### Mail transport configuration
Nodemailer is configured using SMTP credentials from environment variables.

---

## 17. Request and Response Style

The backend follows a simple response pattern:
- success responses return JSON with a message
- errors return JSON with a descriptive message
- cookies are used for auth tokens and session IDs

### Example success response
```json
{
  "message": "Logged In Succesfully"
}
```

### Example error response
```json
{
  "message": "Invalid Credendtials!!"
}
```

---

## 18. Current Authentication Behavior Summary

At a high level, the backend currently behaves like this:

1. User signs up and verifies email.
2. User logs in using OTP.
3. A session and JWT tokens are created.
4. Tokens are stored in Redis.
5. The active session is tracked.
6. Logging in again from another device invalidates old sessions.
7. Protected routes require a valid access token and active session.
8. Refresh token can be used to renew access token.
9. Logout destroys session and clears tokens.

---

## 19. Potential Future Improvements

Although the backend is functional and secure for a basic authentication system, there are several areas where it could be improved further:
- add explicit refresh token revocation list or token family support
- add password reset flow
- add email verification status on the user model
- add more detailed logging and audit trails
- add stronger rate limiting libraries for production
- add test coverage for auth flows
- add role-based access control for admin-only routes
- separate concerns further into services and repositories

---

## 20. Final Notes

This backend is a solid authentication-focused Express application with:
- MongoDB persistence for users
- Redis for sessions and token validation
- JWT-based access/refresh tokens
- email verification and OTP login flow
- protected route middleware
- single-session enforcement across devices

It is well suited for a modern frontend application that requires secure login, protected user routes, and session management.
