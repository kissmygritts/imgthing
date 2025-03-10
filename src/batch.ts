import { readdir, copyFile } from "node:fs/promises"
import path from "node:path"

import { makeDirectory } from "./utils"
import { processOneImage } from "./resize"

export type ProcessImageOptions = {
  size?: number[]
  format?: ("jpg" | "webp" | "avif")[]
  quality?: number
}

type ProcessImageDetail = {
  srcImagePath: string;
  baseImgDir: string;
  outputImagePath: string;
  options: {
      size: number;
      format: string;
      quality: number;
  };
}

type InputImageDetails = {
  fullImagePath: string;
  imageExtension: string;
  imageName: string;
  imageStem: string;
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

  await makeDirectory(sourceDirectory)
  const allFiles = await readdir(sourceDirectory)
  const allImageFiles = allFiles.filter(file => /\.(jpe?g)$/i.test(file))
  const imageProcessingDetails = allImageFiles
    .reduce((acc, image) => {
      const imgSettings = makeImageOutputMap(image, sourceDirectory, destDirectory, size, format, quality)
      return [...acc, ...imgSettings]
    }, [] as ProcessImageDetail[])

  const imageBaseDirectories = imageProcessingDetails
    .map(detail => detail.baseImgDir)
  const uniqueBaseDirectories = new Set(imageBaseDirectories)
  uniqueBaseDirectories.forEach(async directory => await makeDirectory(directory))
    
  await imageProcessingDetails
  .forEach(detail => processOneImage(
    detail.srcImagePath, 
    detail.outputImagePath, 
    detail.options
  ))

  await allImageFiles.map(image => copyInputImage(image, sourceDirectory, destDirectory))
}

function parseInputImageDetails(image: string, sourceDirectory: string): InputImageDetails {
  const fullImagePath = path.join(sourceDirectory, image)
  const imageExtension = path.extname(image)
  const imageName = path.basename(image, imageExtension)

  return {
    fullImagePath,
    imageExtension,
    imageName,
    imageStem: image
  }
}

function makeImageOutputMap(
  image: string,
  sourceDirectory: string,
  destDirectory: string,
  size: number[],
  format: string[],
  quality: number
) {
  const inputImageDetails = parseInputImageDetails(image, sourceDirectory)

  const imgBaseDirectories = format.reduce((acc, format) => {
    acc[format] = path.join(destDirectory, inputImageDetails.imageName, format);
    return acc;
  }, {} as Record<string, string>)

  const outputImages = Object
    .entries(imgBaseDirectories)
    .flatMap(([format, baseDir]) =>
      size.map(size => ({
        srcImagePath: inputImageDetails.fullImagePath,
        baseImgDir: baseDir,
        outputImagePath: path.join(baseDir, `${size}.${format}`),
        options: { size, format, quality }
      }))
    )

  // return { fullImagePath, imgBaseDirectories, outputImages }
  return outputImages
}

async function copyInputImage(
  image: string,
  sourceDirectory: string,
  destDirectory: string
): Promise<void> {
  const sourceImageDetails = parseInputImageDetails(image, sourceDirectory)
  const destinationPath = path.join(destDirectory, sourceImageDetails.imageName, sourceImageDetails.imageStem)
  
  await copyFile(sourceImageDetails.fullImagePath, destinationPath)
}