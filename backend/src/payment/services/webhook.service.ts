import { createHmac, timingSafeEqual } from "crypto";

import { redisClient } from "../../redis/client.js";

import { AppError } from "../../utils/AppError.js";
// REMOVED: logger for now as per project decision.

import { paymentService } from "./payment.service.js";

import {
    RAZORPAY_WEBHOOK_EVENTS,
    REDIS_KEYS,
    WEBHOOK_DEDUPE_TTL_SECONDS,
} from "../constants/payment.constants.js";

import { RazorpayWebhookPayload } from "../types/razorpay.types.js";
// CHANGED: RazorpayWebhookPayload now comes from razorpay.types.ts.

// ============================================================================

class WebhookService {

    /**
     * Verifies the X-Razorpay-Signature header against the RAW request body.
     * Must be called with the untouched body bytes — computing the HMAC over
     * a re-serialized JSON object will not match, since key order and
     * whitespace differ from what Razorpay signed.
     */
    verifySignature(
        rawBody: Buffer,
        signature: string,
        secret: string
    ): boolean {

        const expected =
            createHmac(
                "sha256",
                secret
            )
                .update(rawBody)
                .digest("hex");

        const expectedBuf =
            Buffer.from(
                expected,
                "hex"
            );

        const actualBuf =
            Buffer.from(
                signature,
                "hex"
            );

        return (
            expectedBuf.length ===
                actualBuf.length &&
            timingSafeEqual(
                expectedBuf,
                actualBuf
            )
        );

    }

    /**
     * Dedupe key: prefer Razorpay's `x-razorpay-event-id` header when present;
     * fall back to a hash-free identity on (event, entity id, created_at)
     * since Razorpay resends an identical payload on retry, so the composite
     * is stable across redeliveries of the same event.
     */
    private buildDedupeKey(
        eventId: string | undefined,
        payload: RazorpayWebhookPayload
    ): string {

        if (eventId) {
            return eventId;
        }

        const entityId =
            payload.payload.payment?.entity.id ??
            payload.payload.order?.entity.id ??
            payload.payload.refund?.entity.id ??
            payload.payload.payout?.entity.id ??
            "unknown";

        return `${payload.event}:${entityId}:${payload.created_at}`;

    }

    /**
     * Returns true if this event has already been processed (caller should
     * ack and skip), false if this call has claimed it for processing.
     * Uses SET NX EX as an atomic claim so two concurrent deliveries of the
     * same event can't both proceed.
     */
    private async isDuplicate(
        dedupeKey: string
    ): Promise<boolean> {

        const result =
            await redisClient.set(
                REDIS_KEYS.webhookProcessed(
                    dedupeKey
                ),
                "1",
                {
                    NX: true,
                    EX: WEBHOOK_DEDUPE_TTL_SECONDS,
                }
            );

        return result !== "OK";

    }

    async handleEvent(
        payload: RazorpayWebhookPayload,
        eventId?: string
    ): Promise<void> {

        console.log("Entered handleEvent");
console.log("Event inside service:", payload.event);

        const dedupeKey =
            this.buildDedupeKey(
                eventId,
                payload
            );

        if (
            await this.isDuplicate(
                dedupeKey
            )
        ) {

            // Logger removed for now.

            return;

        }

        // Logger removed for now.

        console.log("Expected:", RAZORPAY_WEBHOOK_EVENTS.PAYMENT_CAPTURED);
console.log("Received:", payload.event);

        switch (payload.event) {

            case RAZORPAY_WEBHOOK_EVENTS.PAYMENT_CAPTURED: {

                const entity =
                    payload.payload.payment?.entity;

                if (!entity) {

                    throw new AppError(
                        "payment.captured webhook missing payment entity",
                        400,
                        "INVALID_WEBHOOK_PAYLOAD"
                    );

                }

                await paymentService.handlePaymentCaptured(
                    entity
                );

                break;

            }

            case RAZORPAY_WEBHOOK_EVENTS.PAYMENT_FAILED: {

                const entity =
                    payload.payload.payment?.entity;

                if (!entity) {

                    throw new AppError(
                        "payment.failed webhook missing payment entity",
                        400,
                        "INVALID_WEBHOOK_PAYLOAD"
                    );

                }

                await paymentService.handlePaymentFailed(
                    entity
                );

                break;

            }

            case RAZORPAY_WEBHOOK_EVENTS.ORDER_PAID:

            case RAZORPAY_WEBHOOK_EVENTS.PAYMENT_AUTHORIZED:

            case RAZORPAY_WEBHOOK_EVENTS.REFUND_CREATED:

            case RAZORPAY_WEBHOOK_EVENTS.REFUND_PROCESSED:

            case RAZORPAY_WEBHOOK_EVENTS.REFUND_FAILED:

            case RAZORPAY_WEBHOOK_EVENTS.PAYOUT_PROCESSED:

            case RAZORPAY_WEBHOOK_EVENTS.PAYOUT_REVERSED:

            case RAZORPAY_WEBHOOK_EVENTS.PAYOUT_FAILED:

                // Acknowledged but not acted on yet — refunds are confirmed
                // synchronously in paymentService.initiateRefund, and payout event
                // handling belongs in payout.service once that flow is built out.
                // Logged explicitly so silent gaps are visible in observability,
                // not just "worked by accident."

                // Logger removed for now.

                break;

            default:

                // CHANGED:
                // Throwing here is not recommended because Razorpay would retry
                // indefinitely for an unknown event. Simply acknowledge it.

                // Logger removed for now.

                break;

        }

    }

}

export const webhookService =
    new WebhookService();