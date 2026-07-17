import { Router } from "express";

import {
    userProfileController,
    userSessionsController,
    revokeSessionController,
} from "../controllers/user.controller.js";

import {
    authMiddleware,
} from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authMiddleware);

// ============================================================================
// Profile
// ============================================================================

router.get(
    "/profile",
    userProfileController
);

// ============================================================================
// Sessions
// ============================================================================

router.get(
    "/sessions",
    userSessionsController
);

router.delete(
    "/sessions/:sessionId",
    revokeSessionController
);

export default router;