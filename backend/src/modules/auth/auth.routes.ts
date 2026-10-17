import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '@/middleware/authenticate'
import { validate } from '@/middleware/validate'
import * as authController from './auth.controller'
import { changePasswordSchema, loginSchema, registerStudentSchema } from './auth.validators'

import { isProduction } from '@/config/env'

export const authRouter = Router()

// Tighter than the global /api limiter in production; relaxed in dev for demo testing
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProduction ? 10 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Try again in a few minutes.' },
})

authRouter.post('/register', loginLimiter, validate({ body: registerStudentSchema }), authController.register)
authRouter.post('/login', loginLimiter, validate({ body: loginSchema }), authController.login)
authRouter.post('/refresh', authController.refresh)
authRouter.post('/change-password', authenticate, validate({ body: changePasswordSchema }), authController.changePassword)
authRouter.post('/logout', authenticate, authController.logout)
authRouter.get('/me', authenticate, authController.me)
