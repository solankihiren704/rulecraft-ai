import { Router, type Request, type Response } from 'express'
import { authenticate } from '@/middleware/authenticate'
import { ApiError } from '@/middleware/errorHandler'
import { askAiAssistant } from './ai.service'

export const aiRouter = Router()

aiRouter.use(authenticate)

aiRouter.post('/chat', async (req: Request, res: Response) => {
  const { message, history, route } = req.body

  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new ApiError(400, 'Message is required.')
  }

  const result = await askAiAssistant(
    {
      message: message.trim(),
      history,
      route,
    },
    req.user!,
  )

  res.json({
    success: true,
    data: result,
  })
})
