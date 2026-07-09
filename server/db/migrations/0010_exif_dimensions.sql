-- Pixel dimensions as first-class EXIF columns so the viewer renders them like
-- any other fact (no lazy raw-EXIF read). Backfill existing rows from the stored
-- `other_data` blob — exifr emits ExifImageWidth/Height (EXIF IFD), with the
-- TIFF/IFD0 ImageWidth/Height and PixelX/YDimension as fallbacks.

ALTER TABLE exif_data ADD COLUMN width INTEGER;
ALTER TABLE exif_data ADD COLUMN height INTEGER;

UPDATE exif_data
SET width = COALESCE(
	json_extract(other_data, '$.ExifImageWidth'),
	json_extract(other_data, '$.ImageWidth'),
	json_extract(other_data, '$.PixelXDimension')
)
WHERE other_data IS NOT NULL AND width IS NULL;

UPDATE exif_data
SET height = COALESCE(
	json_extract(other_data, '$.ExifImageHeight'),
	json_extract(other_data, '$.ImageHeight'),
	json_extract(other_data, '$.PixelYDimension')
)
WHERE other_data IS NOT NULL AND height IS NULL;
