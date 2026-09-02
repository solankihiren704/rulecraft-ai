import type { Role } from './index'

// Augments Express's Request with the shape middleware/authenticate.ts
// attaches after verifying the access token, so every controller/service
// gets req.user typed without re-declaring it.
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        role: Role
        departmentId: string | null
      }
    }
  }
}

export {}
