import { Router } from "express";

import { authMiddleware } from "../../middlewares/auth.middleware.js";

import {
    validate,
    createOrderSchema,
    verifyCheckoutSchema,
    refundSchema,
    paymentIdParamSchema,
    rideIdParamSchema,
    listPaymentsQuerySchema,
} from "../validation/payment.validation.js";

import {
    createOrder,
    verifyCheckout,
    getPayment,
    getPaymentsByRide,
    listPayments,
    refundPayment,
} from "../controllers/payment.controller.js";

const router = Router();

// ============================================================================

// Every payment endpoint requires authentication.
router.use(authMiddleware);

// ============================================================================

// Rider payment flow.
router.post(
    "/orders",
    validate(createOrderSchema),
    createOrder
);

router.post(
    "/verify",
    validate(verifyCheckoutSchema),
    verifyCheckout
);

// ============================================================================

// Payment queries.
router.get(
    "/",
    validate(listPaymentsQuerySchema),
    listPayments
);

router.get(
    "/ride/:rideId",
    validate(rideIdParamSchema),
    getPaymentsByRide
);

router.get(
    "/:paymentId",
    validate(paymentIdParamSchema),
    getPayment
);

// ============================================================================

// Refunds.

// NOTE:
// Admin authorization is currently performed inside the controller.
// A dedicated requireRole middleware can be introduced later.

router.post(
    "/:paymentId/refund",
    validate(paymentIdParamSchema),
    validate(refundSchema),
    refundPayment
);

// ============================================================================

export default router;