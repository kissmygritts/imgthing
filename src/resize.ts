import sharp from "sharp"
import path from "path"

export async function resizeImage(
  inputImagePath: string, outputDir: string, size: number) {
  const outputImagePath = path.join(outputDir, `${size}.jpg`)

  try {
    const image = sharp(inputImagePath).rotate().resize({
      width: size,
      height: size,
      fit: "inside"
    })

    await Promise.all([
      image.toFormat("jpeg", { quality: 100 }).toFile(outputImagePath)
    ])

    console.log("Resized images")
  } catch (error) {
    console.log("Error resizing images", error)
  }
}
