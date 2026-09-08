-- Replace the flat, AND-only RuleCondition table with a recursive AND/OR
-- condition tree stored directly on Rule (see the `conditionTree` doc
-- comment in schema.prisma). Existing rows are backfilled before the old
-- table is dropped, so no rule loses its conditions in the migration.

-- 1. Add the new column, nullable for now so the backfill below can run.
ALTER TABLE "Rule" ADD COLUMN "conditionTree" JSONB;

-- 2. Backfill: a rule with exactly one condition becomes that leaf
--    condition directly (no redundant group wrapper). A rule with more
--    than one condition becomes an AND group — the only semantics the old
--    flat model ever supported, so this is a faithful, lossless migration.
UPDATE "Rule" r
SET "conditionTree" = sub.tree
FROM (
  SELECT
    "ruleId",
    CASE
      WHEN COUNT(*) = 1 THEN
        jsonb_build_object(
          'type', 'condition',
          'field', MIN(field),
          'operator', MIN(operator::text),
          'value', MIN(value)
        )
      ELSE
        jsonb_build_object(
          'type', 'group',
          'operator', 'AND',
          'children', jsonb_agg(
            jsonb_build_object('type', 'condition', 'field', field, 'operator', operator::text, 'value', value)
            ORDER BY field
          )
        )
    END AS tree
  FROM "RuleCondition"
  GROUP BY "ruleId"
) sub
WHERE r.id = sub."ruleId";

-- 3. Every existing Rule row has RuleCondition children (the old schema
--    required at least one), so the backfill above always finds a match —
--    safe to make the column required now.
ALTER TABLE "Rule" ALTER COLUMN "conditionTree" SET NOT NULL;

-- 4. Drop the old table and its now-unused enum type.
DROP TABLE "RuleCondition";
DROP TYPE "RuleOperator";
