import express from "express";
import { login, me } from "../controllers/authController.js";
import authRateLimiter from "../middlewares/authRateLimiter.js";
import validateToken from "../middlewares/validateToken.js";

const router = express.Router();

router.post("/login", authRateLimiter, login);
router.get("/me", validateToken, me);

export default router;
