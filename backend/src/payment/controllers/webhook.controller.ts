import { Request, Response } from "express";

import {
    AppError,
} from "../../utils/AppError.js";

// REMOVED: Logger as per current project architecture.

import { webhookService } from "../services/webhook.service.js";

import asyncTryCatchHandler from "../../middlewares/TryCatch.js";

import { RazorpayWebhookPayload } from "../types/razorpay.types.js"; // CHANGED: Moved to razorpay.types.ts.

import {
    RAZORPAY_EVENT_ID_HEADER,
    RAZORPAY_SIGNATURE_HEADER,
} from "../constants/payment.constants.js";

/**
 * IMPORTANT: this route MUST be mounted with `express.raw({ type: 'application/json' })`
 * — NOT `express.json()` — so `req.body` is the untouched Buffer Razorpay
 * signed. Mount it before any global `express.json()` middleware, or scope
 * the raw parser to this route specifically. See payment/routes/webhook.routes.ts.
 */
export const handleRazorpayWebhook =
    asyncTryCatchHandler(async (
        req: Request,
        res: Response
    ) => {

        console.log("Webhook received");
console.log(req.body.event);

        const signature =
            req.headers[
                RAZORPAY_SIGNATURE_HEADER
            ] as string | undefined;

        const eventId =
            req.headers[
                RAZORPAY_EVENT_ID_HEADER
            ] as string | undefined;

        const rawBody =
            req.body as Buffer;

        const secret =
            process.env
                .RAZORPAY_WEBHOOK_SECRET;

        if (!secret) {

            // ADDED: Prevents webhook verification when server is misconfigured.
            throw new AppError(
                "RAZORPAY_WEBHOOK_SECRET is not configured.",
                500,
                "WEBHOOK_SECRET_MISSING"
            );

        }

        if (
            !signature ||
            !Buffer.isBuffer(rawBody)
        ) {

            throw new AppError(
                "Missing signature or raw body.",
                400,
                "INVALID_WEBHOOK_REQUEST"
            );

        }

        const isValid =
            webhookService.verifySignature(
                rawBody,
                signature,
                secret
            );

        if (!isValid) {

            // Logger removed.

            throw new AppError(
                "Invalid webhook signature.",
                400,
                "INVALID_WEBHOOK_SIGNATURE"
            );

        }

        let payload: RazorpayWebhookPayload;

        try {
            payload = JSON.parse(
                rawBody.toString("utf8")
            ) as RazorpayWebhookPayload;
        } catch {
            throw new AppError(
                "Invalid webhook payload JSON.",
                400,
                "INVALID_WEBHOOK_PAYLOAD"
            );
        }

        // Ack fast: Razorpay times out and retries slow responders. We process
        // inline here for simplicity — move this to a queue consumer (RabbitMQ,
        // matching the rest of the platform's event fanout) once webhook volume
        // or handler latency makes synchronous processing risky.

        await webhookService.handleEvent(
            payload,
            eventId
        );

        res.status(200).json({

            status: "ok",

        });

    });