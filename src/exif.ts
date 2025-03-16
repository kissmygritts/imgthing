import ExifReader from "exifreader"
import { camelize } from "./utils"

const RAW_EXIF_KEYS = {
  ApertureValue: {
    commonName: "aperture",
    valueFormatFn: (s: string) => s,
  },
  DateTimeOriginal: {
    commonName: "createdAt",
    valueFormatFn: (s: string) => s,
  },
  ExposureTime: {
    commonName: "shutterSpeed",
    valueFormatFn: (s: string) => s,
  },
  FNumber: {
    commonName: "fStop",
    valueFormatFn: (s: string) => s,
  },
  FocalLength: {
    commonName: "focalLength",
    valueFormatFn: (s: string) => s,
  },
  FocalLengthIn35mmFilm: {
    commonName: "focalLength35mm",
    valueFormatFn: (s: string) => s,
  },
  "Image Height": {
    commonName: "height",
    valueFormatFn: (s: string) => s,
  },
  "Image Width": {
    commonName: "width",
    valueFormatFn: (s: string) => s,
  },
  ISOSpeedRatings: {
    commonName: "iso",
    valueFormatFn: (s: string) => s,
  },
  Lens: {
    commonName: "lensModel",
    valueFormatFn: (s: string) => s,
  },
  Model: {
    commonName: "cameraModel",
    valueFormatFn: (s: string) => s,
  },
  ShutterSpeedValue: {
    commonName: "shutterSpeed2",
    valueFormatFn: (s: string) => s,
  },
}

export async function readExifData(imagePath: string): Promise<Record<string, string>> {
  const tags = await ExifReader.load(imagePath)
  const imageProps = pickExifTags(tags, RAW_EXIF_KEYS)

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
): Record<string, string> {
  return Object.fromEntries(
    keys.map((key) => [RAW_EXIF_KEYS[key].commonName, obj[key].description]),
  ) as Record<string, string>
}
