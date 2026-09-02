import 'dotenv/config'
import { z } from 'zod'

/**
 * env.ts
 * Loads and validates all required environment variables ONCE at startup
 * using Zod, so the app fails fast with a clear error message instead of
 * crashing later (or silently misbehaving) when a variable is missing or
 * malformed. Every other file should import `env` from here instead of
 * reading `process.env` directly.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // 32 chars is a floor, not a target — common HS256 guidance is 256+
  // bits (32+ bytes) of real entropy. The documented generation command
  // (README's Environment variables section) produces 96-char hex
  // strings, well above this; raised from a 16-char floor since that was
  // below guidance and every documented/actual secret already clears 32.
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters — generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters — generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  FRONTEND_URL: z.string().default('http://localhost:5173'),

  // AI is optional by design (see docs/architecture) — the app must keep
  // working with the deterministic rule engine even if this is blank.
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-1.5-flash'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),

  // Report storage is behind an abstraction (src/modules/reports/storage)
  // so swapping 'local' for a future 'S3' driver never touches the reports
  // service/controller — only a new driver implementation.
  STORAGE_DRIVER: z.enum(['local']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./storage'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables. Check backend/.env against .env.example.')
}

export const env = parsed.data
export const isProduction = env.NODE_ENV === 'production'
export const isAiConfigured = env.GEMINI_API_KEY.trim().length > 0
