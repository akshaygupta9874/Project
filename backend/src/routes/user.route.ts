import {Router} from "express"
import { userProfileController, userSessionsController } from "../controllers/user.controller.js"
import { authMiddleware } from "../middlewares/isAuthenticated.js"
import { revokeSessionController } from "../controllers/user.controller.js"

const userRouter = Router()

userRouter.get("/profile",authMiddleware,userProfileController)
userRouter.get("/sessions",authMiddleware,userSessionsController)
userRouter.post("/removeSession/:sessionId",authMiddleware,revokeSessionController)

export default userRouter;