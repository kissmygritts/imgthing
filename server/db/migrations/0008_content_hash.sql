-- Duplicate detection: SHA-256 of the original bytes, computed at upload time.
-- Nullable — pre-existing rows and any upload where hashing fails stay NULL
-- (no backfill; there's no deployed data, same reasoning as variants self-heal).
ALTER TABLE photos ADD COLUMN content_hash TEXT;

CREATE INDEX idx_photos_content_hash ON photos (content_hash);
