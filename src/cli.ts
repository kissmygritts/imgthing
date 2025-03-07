#!/usr/bin/env bun

import { Command } from "commander"
import { resizeImage } from "./resize.js"
import path from "path"

const program = new Command();
program
  .name("img-resize")
  .description("A simple CLI for image resizing and compression")
  .version("0.0.1")

program
  .command("resize")
  .description("Resize an image to the specified dimensions and formats")
  .argument("<input>", "Path to the input inmage")
  .option("-o --output <folder>", "Output directory", "./output")
  .option("-s --size <number>", "Resize the image so that the longest edge is the given size", "1024")
  .option("-f --format <type>", "Image format (jpg/webp)", "jpg")
  .action(async (input: string, options) => {
    const fullImagePath = path.resolve(input)
    const fullOutputPath = path.resolve(options.output)
    const size = parseInt(options.size, 10)
    const format = options.format

    try {
      await resizeImage(fullImagePath, fullOutputPath, {size: size, format: format})
    } catch (error) {
      console.log(`Error processing image`, error)
    }
  })

program.parse(process.argv)
