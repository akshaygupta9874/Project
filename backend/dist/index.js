import express from "express";
import { createClient } from "redis";
import cors from "cors";
import mongoSanitize from 'express-mongo-sanitize';
import helmet from "helmet";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import connectDB from "./config/db.config.js";
import useRouter from "./routes/user.route.js";
import errorHandler from "./middlewares/errorHandler.js";
import { sessionMiddleware } from "./middlewares/session.middleware.js";
dotenv.config();
const app = express();
//middlewares
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true
}));
app.use(express.json());
app.use(mongoSanitize());
app.use(helmet());
app.use(cookieParser());
app.use(sessionMiddleware);
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
    console.log("Please Provide Redis URL ! ");
    process.exit(1);
}
export const redisClient = createClient({
    url: redisUrl,
    socket: {
        reconnectStrategy: false
    }
});
//redisClient.on('error', ...): Redis is a separate server. If that server goes down, your app will throw an error. This line tells your app: "If you ever have a problem with Redis, just log the error instead of crashing the whole application."
redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.connect()
    .then(() => {
    console.log("connected to Redis");
})
    .catch((err) => {
    console.error("Failed to connect to Redis. Please start Redis or update REDIS_URL in backend/.env.", err);
    process.exit(1);
});
connectDB();
app.use("/v1/api", useRouter);
app.use(errorHandler);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend is Running on PORT :- ${PORT}`);
});
//# sourceMappingURL=index.js.map