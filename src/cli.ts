#!/usr/bin/env bun

import { Command } from "commander"
import { resizeImage } from "./resize.js"
// import { batchProcessImages } from "./batch.js"
import { batchProcessImages } from "./batch-v2.js"
import { readExifData } from "./exif.js"
import path from "path"

const program = new Command()
program.name("imgthing").description("A simple CLI of image utilities").version("0.0.1")

program
  .command("resize")
  .description("Resize an image to the specified dimensions and formats")
  .argument("<input>", "Path to the input inmage")
  .option("-o --output <folder>", "Output directory", "./output")
  .option(
    "-s --size <number>",
    "Resize the image so that the longest edge is the given size",
    "1024",
  )
  .option("-f --format <type>", "Image format (jpg/webp)", "jpg")
  .action(async (input: string, options) => {
    const fullImagePath = path.resolve(input)
    const fullOutputPath = path.resolve(options.output)
    const size = parseInt(options.size, 10)
    const format = options.format

    try {
      await resizeImage(fullImagePath, fullOutputPath, { size: size, format: format })
    } catch (error) {
      console.log(`Error processing image`, error)
    }
  })

program
  .command("batch")
  .description("Batch process a directory of images")
  .argument("<inDirectory>", "Input directory of images")
  .argument("<outDirectory>", "Output directory location for processed images")
  .option(
    "-s --size <number...>",
    "Resize the images so that their longest edge is the given size. Multiple sizes are allowed. Each size in the list will be generated",
    ["1024"],
  )
  .option(
    "-f --format <string...>",
    "The output image format. If multiple formats are provided an image for each format will be created.",
    ["jpg"],
  )
  .option("-q --quality <number>", "The output image quality.", "80")
  .action(async (inDirectory: string, outDirectory: string, options) => {
    const sourceDirectory: string = path.resolve(inDirectory)
    const destDirectory: string = path.resolve(outDirectory)
    const size: number[] = options.size.map((size: string) => parseInt(size, 10))
    const quality: number = parseInt(options.quality, 10)
    const parsedOptions = { size, format: options.format, quality }

    const output = await batchProcessImages(sourceDirectory, destDirectory, {
      ...parsedOptions,
      size,
    })
    // console.log(JSON.stringify(output, null, 2))
  })

program
  .command("exif")
  .description("Extract EXIF data from an image")
  .argument("<input>", "Path to the input image")
  .option("--pretty", "Pretty print the EXIF JSON output")
  .action(async (input: string, options) => {
    const prettyPrint = Boolean(options.pretty)
    const fullImagePath = path.resolve(input)
    const exifData = await readExifData(fullImagePath)
    const exifJson = prettyPrint ? JSON.stringify(exifData, null, 2) : JSON.stringify(exifData)

    process.stdout.write(exifJson)
  })

program.parse(process.argv)
