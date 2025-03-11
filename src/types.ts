export type ImageFormat = "jpeg" | "webp" | "avif"

export type ResizeOptions = {
  width?: number
  height?: number
  size?: number
  format?: ImageFormat
  quality?: number
}

export type ProcessImageOptions = {
  size?: number[]
  format?: ImageFormat[]
  quality?: number
}

export type ProcessImageDetail = {
  srcImagePath: string
  baseImgDir: string
  outputImagePath: string
  options: {
    size: number
    format: ImageFormat
    quality: number
  }
}

export type InputImageDetails = {
  fullImagePath: string
  imageExtension: string
  imageName: string
  imageStem: string
}
