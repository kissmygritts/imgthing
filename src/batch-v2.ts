import { readdir, copyFile } from "node:fs/promises"
import { makeDirectory } from "./utils"
import { readExifData } from "./exif"
import path from "node:path"

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".tiff", ".gif"]

// Define the interface for image variants
interface ImageVariant {
  imagePath: string // Full path to the original image
  imageStem: string // Filename with extension
  imageName: string // Filename without extension
  outputDir: string // Base output directory for this image
  formats: string[] // Array of formats to convert to
  sizes: number[] // Array of sizes to resize to
  quality: number // Output quality
}

export async function batchProcessImages(
  sourceDirectory: string,
  destDirectory: string,
  options = {},
) {
  console.log(options)

  const allFiles = await readdir(sourceDirectory)
  const allImageFiles = await allFiles
    .filter((file) => IMAGE_EXTENSIONS.includes(path.extname(file).toLowerCase()))
    .map(async (imageFile) => {
      const fullPath = path.join(sourceDirectory, imageFile)
      const extension = path.extname(imageFile)
      const name = path.basename(imageFile, extension)
      const destinationBasePath = path.join(destDirectory, name)
      const destinationImagePath = path.join(destinationBasePath, imageFile)

      const sourceImageDetails = {
        fullPath,
        destinationBasePath,
        destinationImagePath,
        stem: imageFile,
        name,
        extension,
      }
      const imageVariants = makeImageVariantDetails(sourceImageDetails, options)
      const exif = await readExifData(fullPath)

      return {
        fullPath,
        destinationBasePath,
        destinationImagePath,
        stem: imageFile,
        name,
        extension,
        exif,
        imageVariants,
      }
    })

  const outputDetails = await Promise.all(allImageFiles)

  const outputDirectories = outputDetails.flatMap((images) =>
    images.imageVariants.map((variant) => variant.outputBaseDirectory),
  )
  const uniqueOutputDirectories = new Set(outputDirectories)
  await makeDirectories([destDirectory, ...outputDirectories])

  console.log(uniqueOutputDirectories)
}

function makeImageVariantDetails(sourceImageDetails, { size: sizes, format: formats, quality }) {
  return formats.flatMap((format) => {
    return sizes.map((size) => {
      const outputImageName = `${sourceImageDetails.name}__${size}.${format}`
      const outputBaseDirectory = path.join(sourceImageDetails.destinationBasePath, format)
      const outputPath = path.join(outputBaseDirectory, outputImageName)

      return {
        outputPath,
        outputBaseDirectory,
        outputImageName,
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
