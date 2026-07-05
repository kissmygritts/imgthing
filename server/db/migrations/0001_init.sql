-- imgthing initial schema
-- Single-owner photo library: no user_id scoping anywhere.

CREATE TABLE folders (
	id               TEXT PRIMARY KEY,
	name             TEXT NOT NULL,
	parent_folder_id TEXT REFERENCES folders (id) ON DELETE CASCADE,
	created_at       TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_folders_parent ON folders (parent_folder_id);

CREATE TABLE photos (
	id                TEXT PRIMARY KEY,
	original_filename TEXT NOT NULL,
	r2_key            TEXT NOT NULL UNIQUE,
	content_type      TEXT NOT NULL,
	file_size         INTEGER NOT NULL,
	folder_id         TEXT REFERENCES folders (id) ON DELETE SET NULL,
	uploaded_at       TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_photos_folder ON photos (folder_id);
CREATE INDEX idx_photos_uploaded ON photos (uploaded_at);

CREATE TABLE exif_data (
	id            TEXT PRIMARY KEY,
	photo_id      TEXT NOT NULL UNIQUE REFERENCES photos (id) ON DELETE CASCADE,
	camera_make   TEXT,
	camera_model  TEXT,
	lens_info     TEXT,
	exposure      TEXT,
	aperture      TEXT,
	iso           INTEGER,
	focal_length  TEXT,
	taken_at      TEXT,
	gps_latitude  REAL,
	gps_longitude REAL,
	-- SQLite has no jsonb; raw/extra EXIF stored as JSON TEXT, parsed in app.
	other_data    TEXT
);

CREATE INDEX idx_exif_taken_at ON exif_data (taken_at);
