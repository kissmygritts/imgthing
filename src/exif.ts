import ExifReader from "exifreader"

const EXIF_KEYS = [
  "ApertureValue",
  "DateTimeOriginal",
  "ExposureTime",
  "FNumber",
  "FocalLength",
  "FocalLengthIn35mmFilm",
  "Image Height",
  "Image Width",
  "ISOSpeedRatings",
  "Lens",
  "Model",
  "ShutterSpeedValue",
]

export async function readExifData(imagePath: string): Promise<Record<string, string>> {
  const tags = await ExifReader.load(imagePath)
  const imageProps = pickExifTags(tags, EXIF_KEYS)

  return imageProps
}

/**
 * Picks specified keys from an object
 * @param obj The source object
 * @param keys Array of keys to pick from the object
 * @returns A new object with only the description of the picked keys
 */
function pickExifTags<T extends Record<string, { description: string }>, K extends keyof T>(
  obj: T,
  keys: K[],
): Record<K, string> {
  return Object.fromEntries(keys.map((key) => [key, obj[key].description])) as Record<K, string>
}
