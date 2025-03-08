import { readdir } from "node:fs/promises"
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
  
  const imageProcessingDetails = allFiles
    .filter(file => /\.(jpe?g)$/i.test(file))
    .reduce((acc, image) => {
      const imgSettings = makeImageOutputMap(image, sourceDirectory, destDirectory, size, format, quality)
      return [...acc, ...imgSettings]
    }, [] as ProcessImageDetail[])

  const imageBaseDirectories = imageProcessingDetails
    .map(detail => detail.baseImgDir)
  const uniqueBaseDirectories = new Set(imageBaseDirectories)
  uniqueBaseDirectories.forEach(async directory => await makeDirectory(directory))
    

  console.log(imageProcessingDetails)

  imageProcessingDetails
  .forEach(detail => processOneImage(
    detail.srcImagePath, 
    detail.outputImagePath, 
    detail.options
  ))
}

function makeImageOutputMap(
  image: string,
  sourceDirectory: string,
  destDirectory: string,
  size: number[],
  format: string[],
  quality: number
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
      size.map(size => ({
        srcImagePath: fullImagePath,
        baseImgDir: baseDir,
        outputImagePath: path.join(baseDir, `${size}.${format}`),
        options: { size, format, quality }
      }))
    )

  // return { fullImagePath, imgBaseDirectories, outputImages }
  return outputImages
}