import { readdir } from "node:fs/promises"
import path from "node:path"

export type ProcessImageOptions = {
  size?: number[]
  format?: ("jpg" | "webp" | "avif")[]
  quality?: number
}

const DEFAULT_OPTIONS: Required<ProcessImageOptions> = {
  size: [1024],
  format: ["jpg"],
  quality: 80
}

export async function batchProcessImages(
  sourceDirectory: string,
  destDirectory: string,
  options: ProcessImageOptions = {}
) {
  const { size, format, quality } = { ...DEFAULT_OPTIONS, ...options }

  const allFiles = await readdir(sourceDirectory)
  const images = allFiles
    .filter(file => /\.(jpe?g)$/i.test(file))
    .map(image => makeImageOutputMap(image, sourceDirectory, destDirectory, size, format))

  console.log(images)
}

function makeImageOutputMap(
  image: string,
  sourceDirectory: string,
  destDirectory: string,
  size: number[],
  format: string[]
) {
  const fullImagePath = path.join(sourceDirectory, image)
  const imageExtension = path.extname(image)
  const imageName = path.basename(image, imageExtension)

  const imgBaseDirectories = format.reduce((acc, format) => {
    acc[format] = path.join(destDirectory, imageName, format);
    return acc;
  }, {} as Record<string, string>)

  const outputImages = Object
    .entries(imgBaseDirectories)
    .flatMap(([format, baseDir]) =>
      size.map(size => path.join(baseDir, `${size}.${format}`))
    )

  return { fullImagePath, imgBaseDirectories, outputImages }
}