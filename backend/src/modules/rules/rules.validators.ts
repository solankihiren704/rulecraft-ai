import { z } from 'zod'
import type { ConditionNode } from '@/types'

const leafConditionSchema = z.object({
  type: z.literal('condition'),
  field: z.string().trim().min(1, 'Field is required.'),
  operator: z.enum(['gte', 'lte', 'gt', 'lt', 'eq', 'neq']),
  value: z.string().trim().min(1, 'Value is required.'),
})

// Recursive: a group's children can themselves be leaves or nested groups,
// so the schema has to reference itself — z.lazy() is what makes that
// possible in Zod (a plain object literal can't self-reference).
export const conditionNodeSchema: z.ZodType<ConditionNode> = z.lazy(() =>
  z.union([
    leafConditionSchema,
    z.object({
      type: z.literal('group'),
      operator: z.enum(['AND', 'OR']),
      children: z.array(conditionNodeSchema).min(1, 'A group needs at least one condition.'),
    }),
  ]),
)

export const createRuleSchema = z.object({
  name: z.string().trim().min(3, 'Rule name must be at least 3 characters.'),
  regulationId: z.string().uuid('Select a regulation.'),
  type: z.enum(['attendance', 'passing', 'grading', 'promotion', 'backlog', 'grace_marks']),
  outcome: z.string().trim().min(3, 'Describe the outcome.'),
  active: z.boolean().default(true),
  conditionTree: conditionNodeSchema,
})

// Deliberately excludes regulationId: a rule's parent regulation is fixed
// at creation. Reassigning a rule to a different regulation isn't a
// supported operation (moving it would need immutability checks on BOTH
// the source and target regulation) — to change which regulation a rule
// belongs to, duplicate the regulation and recreate the rule there.
export const updateRuleSchema = createRuleSchema.omit({ regulationId: true })

export const listRulesQuerySchema = z.object({
  regulationId: z.string().uuid().optional(),
  type: z.enum(['attendance', 'passing', 'grading', 'promotion', 'backlog', 'grace_marks']).optional(),
  active: z.coerce.boolean().optional(),
})

export type CreateRuleInput = z.infer<typeof createRuleSchema>
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>
export type ListRulesQuery = z.infer<typeof listRulesQuerySchema>
