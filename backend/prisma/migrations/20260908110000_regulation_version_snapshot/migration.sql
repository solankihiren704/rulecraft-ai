-- Adds a nullable snapshot column to RegulationVersion for the version
-- diff viewer. Purely additive: existing rows get NULL, correctly meaning
-- "no snapshot was ever captured for this historical version" rather than
-- fabricated data — there's nothing to backfill since no prior snapshot
-- ever existed.
ALTER TABLE "RegulationVersion" ADD COLUMN "snapshot" JSONB;
