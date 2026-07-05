-- T6 Favorites: heart a photo. Single-owner library, so a plain flag column on
-- photos is enough (no per-user join table needed).

ALTER TABLE photos ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_photos_favorite ON photos (is_favorite);
