import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '@/middleware/authenticate'
import { validate } from '@/middleware/validate'
import * as authController from './auth.controller'
import { loginSchema } from './auth.validators'

export const authRouter = Router()

// Tighter than the global /api limiter — login is the one route worth
// specifically defending against credential-stuffing/brute force.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Try again in a few minutes.' },
})

authRouter.post('/login', loginLimiter, validate({ body: loginSchema }), authController.login)
authRouter.post('/refresh', authController.refresh)
authRouter.post('/logout', authenticate, authController.logout)
authRouter.get('/me', authenticate, authController.me)
