-- Folder-level publishing (public galleries). Mirrors 0006_public_photos.sql at
-- folder granularity: visibility/public_token/published_at drive the tokened
-- public gallery routes under server/routes/f/**. The folder token is an
-- independent credential — it bypasses each member photo's own visibility.
--
-- Deliberately narrower than the per-photo model (see ADR 0008): no show_location
-- (GPS stays per-photo), no include_subfolders (direct members only, no nesting),
-- no stored slug (the URL slug is cosmetic), no variants_generated_at (folders own
-- no bytes — variants live on the per-photo objects and self-heal there).
--
-- SQLite can't ADD COLUMN with UNIQUE, hence the separate index.

ALTER TABLE folders ADD COLUMN visibility   TEXT NOT NULL DEFAULT 'private';
ALTER TABLE folders ADD COLUMN public_token TEXT;
ALTER TABLE folders ADD COLUMN published_at TEXT;

CREATE UNIQUE INDEX idx_folders_public_token ON folders (public_token);
