-- Public sharing + precomputed variants. visibility/public_token/published_at drive
-- the tokened public routes; show_location gates GPS in the public meta endpoint;
-- variants_generated_at records that the fixed R2 variants exist (NULL = pending,
-- the serving routes self-heal). SQLite can't ADD COLUMN with UNIQUE, hence the index.

ALTER TABLE photos ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';
ALTER TABLE photos ADD COLUMN public_token TEXT;
ALTER TABLE photos ADD COLUMN published_at TEXT;
ALTER TABLE photos ADD COLUMN show_location INTEGER NOT NULL DEFAULT 0;
ALTER TABLE photos ADD COLUMN variants_generated_at TEXT;

CREATE UNIQUE INDEX idx_photos_public_token ON photos (public_token);
