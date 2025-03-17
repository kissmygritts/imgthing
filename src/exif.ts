import ExifReader from "exifreader"

interface ExifTagValue {
  id?: number
  value: number | number[] | string | string[]
  description: string
}

interface ExifTags {
  [tagName: string]: ExifTagValue
}

interface ExifKeyMapping {
  commonName: string
  valueFormatFn: (exifValue: ExifTagValue) => number | string
}

interface RawExifKeys {
  [exifKey: string]: ExifKeyMapping
}

const RAW_EXIF_KEYS: RawExifKeys = {
  DateTimeOriginal: {
    commonName: "createdAt",
    valueFormatFn: (exifValue: ExifTagValue) => exifValue.description,
  },
  ExposureTime: {
    commonName: "shutterSpeed",
    valueFormatFn: (exifValue: ExifTagValue) => exifValue.description,
  },
  ApertureValue: {
    commonName: "aperture",
    valueFormatFn: (exifValue: ExifTagValue) => parseFloat(exifValue.description),
  },
  FocalLength: {
    commonName: "focalLength",
    valueFormatFn: (exifValue: ExifTagValue) =>
      parseFloat(exifValue.description.replace(" mm", "")),
  },
  FocalLengthIn35mmFilm: {
    commonName: "focalLength35mm",
    valueFormatFn: (exifValue: ExifTagValue) => exifValue.description,
  },
  "Image Height": {
    commonName: "height",
    valueFormatFn: (exifValue: ExifTagValue) => parseFloat(exifValue.description.replace("px", "")),
  },
  "Image Width": {
    commonName: "width",
    valueFormatFn: (exifValue: ExifTagValue) => parseFloat(exifValue.description.replace("px", "")),
  },
  ISOSpeedRatings: {
    commonName: "iso",
    valueFormatFn: (exifValue: ExifTagValue) => exifValue.description,
  },
  Lens: {
    commonName: "lensModel",
    valueFormatFn: (exifValue: ExifTagValue) => exifValue.description,
  },
  Make: {
    commonName: "cameraMake",
    valueFormatFn: (exifValue: ExifTagValue) => exifValue.description,
  },
  Model: {
    commonName: "cameraModel",
    valueFormatFn: (exifValue: ExifTagValue) => exifValue.description,
  },
}

export async function readExifData(imagePath: string) {
  const tags: ExifTags = await ExifReader.load(imagePath)
  const imageProps = pickExifTags(tags, RAW_EXIF_KEYS)

  return {
    ...imageProps,
    orientation: detectOrientation(imageProps.height as number, imageProps.width as number),
  }
}

function pickExifTags(exifData: ExifTags, keyGetter: RawExifKeys) {
  const keys = Object.keys(keyGetter)
  return Object.fromEntries(
    keys.map((key) => [keyGetter[key].commonName, keyGetter[key].valueFormatFn(exifData[key])]),
  )
}

function detectOrientation(height: number, width: number): string {
  const remainder = height / width
  switch (true) {
    case remainder == 1:
      return "square"
    case remainder > 1:
      return "portrait"
    case remainder < 1:
      return "landscape"
    default:
      return "nil"
  }
}
