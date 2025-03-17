import { readdir, copyFile } from "node:fs/promises"
import { makeDirectory } from "./utils"
import { readExifData } from "./exif"
import { calculateResizedDimensions } from "./img"
import { processOneImage } from "./resize"
import path from "node:path"
import { write } from "bun"

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".tiff", ".gif"]

// Define the interface for image variants
interface ImageVariant {
  imagePath: string
  imageStem: string
  imageName: string
  outputDir: string
  formats: string[]
  sizes: number[]
  quality: number
}

// interface SourceImageDetails {
//   fullPath: string
//   destinationBasePath: string
//   destinationImagePath: string
//   stem: string
//   name: string
//   extension: string
// }

export async function batchProcessImages(
  sourceDirectory: string,
  destDirectory: string,
  options = {},
) {
  // generate output image details
  const allFiles = await readdir(sourceDirectory)
  const allImageFiles = await allFiles
    .filter((file) => IMAGE_EXTENSIONS.includes(path.extname(file).toLowerCase()))
    .map(async (imageFile) => makeImageDetails(imageFile, sourceDirectory, destDirectory, options))
  const outputDetails = await Promise.all(allImageFiles)

  // prep output directories
  const outputDirectories = outputDetails.flatMap((images) =>
    images.imageVariants.map((variant) => variant.outputBaseDirectory),
  )
  const uniqueOutputDirectories = new Set(outputDirectories)
  await makeDirectories([destDirectory, ...uniqueOutputDirectories])

  // generate resized images
  const resizedImages = outputDetails.flatMap(async (image) => {
    const json = JSON.stringify(image, null, 2)
    await write(image.metadataPath, json)
    await copyFile(image.fullPath, image.destinationImagePath)

    return image.imageVariants.map((variant) =>
      processOneImage(image.fullPath, variant.outputPath, variant.options),
    )
  })
  await Promise.all(resizedImages)

  return outputDetails
}

async function makeImageDetails(
  imageFile: string,
  sourceDirectory: string,
  destDirectory: string,
  options,
) {
  const fullPath = path.join(sourceDirectory, imageFile)
  const extension = path.extname(imageFile)
  const name = path.basename(imageFile, extension)
  const destinationBasePath = path.join(destDirectory, name)
  const destinationImagePath = path.join(destinationBasePath, imageFile)
  const metadataPath = path.join(destinationBasePath, `${name}.metadata.json`)

  let sourceImageDetails = {
    fullPath,
    destinationBasePath,
    destinationImagePath,
    stem: imageFile,
    name,
    extension,
    metadataPath,
  }
  const exif = await readExifData(fullPath)
  sourceImageDetails = { ...sourceImageDetails, exif }
  const imageVariants = makeImageVariantDetails(sourceImageDetails, options)

  return {
    ...sourceImageDetails,
    imageVariants,
  }
}

function makeImageVariantDetails(sourceImageDetails, { size: sizes, format: formats, quality }) {
  return formats.flatMap((format) => {
    return sizes.map((size) => {
      const outputImageName = `${sourceImageDetails.name}__${size}.${format}`
      const outputBaseDirectory = path.join(sourceImageDetails.destinationBasePath, format)
      const outputPath = path.join(outputBaseDirectory, outputImageName)

      const { width, height } = calculateResizedDimensions(
        sourceImageDetails?.exif?.width,
        sourceImageDetails?.exif?.height,
        size,
      )
      const variantExif = { ...sourceImageDetails?.exif, width, height }

      return {
        outputPath,
        outputBaseDirectory,
        outputImageName,
        exif: variantExif,
        options: {
          size,
          format,
          quality,
        },
      }
    })
  })
}

async function makeDirectories(directories: string[]) {
  await Promise.all(directories.map((dir) => makeDirectory(dir)))
}
