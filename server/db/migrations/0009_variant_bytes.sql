-- Storage accounting: total bytes of the three precomputed WebP variants for a
-- photo, summed and recorded whenever generateVariants runs (upload + self-heal).
-- Nullable — pre-existing rows and any photo whose variants haven't been
-- generated/healed yet stay NULL and count as 0 tracked variant bytes, so the
-- usage endpoint labels its variant total as possibly incomplete. Additive, no
-- backfill: self-heal fills it in the first time a variant is regenerated.

ALTER TABLE photos ADD COLUMN variant_bytes INTEGER;
