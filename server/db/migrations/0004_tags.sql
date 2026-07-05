-- M7 Tags: free-form tags per photo (many-to-many). Mirrors the folder_photos
-- junction design — a tags table plus a photo_tags junction with cascading FKs,
-- so deleting either a tag or a photo cleans up its junction rows.

CREATE TABLE tags (
	id         TEXT PRIMARY KEY,
	-- Case-insensitive unique names: "Sunset" and "sunset" are the same tag.
	name       TEXT NOT NULL COLLATE NOCASE UNIQUE,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE photo_tags (
	tag_id   TEXT NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
	photo_id TEXT NOT NULL REFERENCES photos (id) ON DELETE CASCADE,
	added_at TEXT NOT NULL DEFAULT (datetime('now')),
	PRIMARY KEY (tag_id, photo_id)
);

CREATE INDEX idx_photo_tags_photo ON photo_tags (photo_id);
