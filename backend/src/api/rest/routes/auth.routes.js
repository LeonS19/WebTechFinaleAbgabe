// TODO Tag 2 – Person A: Google OAuth + Passkey Routes
import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
export const authRoutes = Router();

authRoutes.post('/passkey/register/options', authController.registerOptions)
authRoutes.post('/passkey/register/verify', authController.registerVerify)
authRoutes.post('/passkey/login/options', authController.loginOptions)
authRoutes.post('/passkey/login/verify', authController.loginVerify)
authRoutes.delete('/passkey/:id', authMiddleware, authController.removePasskeyHandler)

