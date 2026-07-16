import { Router, raw } from "express";

import { handleRazorpayWebhook } from "../controllers/webhook.controller.js";

const router = Router();

// ============================================================================

// No `authMiddleware` here — Razorpay is the caller, not a logged-in user.
// The signature check inside handleRazorpayWebhook is the authentication boundary.
// `raw()` is scoped to this router only, so it never affects the global
// express.json() middleware used by the rest of the application.

router.post(
    "/razorpay",
    raw({
        type: "application/json",
    }),
    handleRazorpayWebhook
);

// ============================================================================

export default router;