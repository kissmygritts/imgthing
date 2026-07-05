-- M4 Folder Management: photos can belong to many folders (many-to-many).
-- Replaces the single photos.folder_id with a folder_photos junction table.

CREATE TABLE folder_photos (
	folder_id TEXT NOT NULL REFERENCES folders (id) ON DELETE CASCADE,
	photo_id  TEXT NOT NULL REFERENCES photos (id) ON DELETE CASCADE,
	added_at  TEXT NOT NULL DEFAULT (datetime('now')),
	PRIMARY KEY (folder_id, photo_id)
);

CREATE INDEX idx_folder_photos_photo ON folder_photos (photo_id);

-- Carry over any existing single-folder memberships.
INSERT INTO folder_photos (folder_id, photo_id)
SELECT folder_id, id FROM photos WHERE folder_id IS NOT NULL;

-- Retire the single-owner column.
DROP INDEX idx_photos_folder;
ALTER TABLE photos DROP COLUMN folder_id;
