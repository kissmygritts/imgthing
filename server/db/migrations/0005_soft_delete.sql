-- S1 Soft delete / trash: photos gain a nullable deleted_at tombstone. NULL = a
-- live photo; an ISO timestamp = moved to Trash (hidden from every normal listing
-- but still present in R2/D1 until permanently purged). Indexed so both the "live"
-- (deleted_at IS NULL) and "trash" (deleted_at IS NOT NULL) filters stay cheap.

ALTER TABLE photos ADD COLUMN deleted_at TEXT;

CREATE INDEX idx_photos_deleted_at ON photos (deleted_at);
