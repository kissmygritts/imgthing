import { mkdir, exists } from "node:fs/promises"
import path from "path"
import sharp from "sharp"

export type ResizeOptions = {
  width?: number
  height?: number
  size?: number
  format?: "jpeg" | "webp" | "avif"
  quality?: number
}

const DEFAULT_OPTIONS: Required<ResizeOptions> = {
  size: 1024,
  format: "jpeg",
  quality: 80,
  width: 0,
  height: 0
}

export async function resizeImage(
  inputImagePath: string,
  outputDir: string,
  options: ResizeOptions = {}
) {
  const { width, height, size, format, quality } = { ...DEFAULT_OPTIONS, ...options }

  const inputImageName = path.basename(inputImagePath).split(".")[0]
  const outputFilename = `${size || width || height}.${format}`
  const outputBaseDir = path.join(outputDir, inputImageName)
  const outputImagePath = path.join(outputBaseDir, outputFilename)

  const baseDirExists = await exists(outputBaseDir)
  if (!baseDirExists) {
    await mkdir(outputBaseDir)
  }

  try {
    let image = sharp(inputImagePath)
      .sharpen({ sigma: 0.5 })
      .rotate()

    if (size) {
      image = image.resize({ width: size, height: size, fit: "inside" })
    } else {
      image = image.resize({ width, height, fit: "inside" })
    }
    await image.toFormat(format, { quality }).toFile(outputImagePath)

    console.log("Resized images")
  } catch (error) {
    console.log("Error resizing images", error)
  }
}

export async function processOneImage(
  inputImagePath: string,
  outputImagePath: string,
  options: ResizeOptions = {}
) {
  const { width, height, size, format, quality } = { ...DEFAULT_OPTIONS, ...options }

  try {
    let image = sharp(inputImagePath)
      .sharpen({ sigma: 0.5 })
      .rotate()

    if (size) {
      image = image.resize({ width: size, height: size, fit: "inside" })
    } else {
      image = image.resize({ width, height, fit: "inside" })
    }

    await image.toFormat(format, { quality }).toFile(outputImagePath)
  } catch (error) {
    throw error
  }
}