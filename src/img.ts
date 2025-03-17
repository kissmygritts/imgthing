/**
 * Represents the dimensions of an image
 */
interface ImageDimensions {
  width: number
  height: number
}

/**
 * Calculates new image dimensions when resizing to a specific maximum dimension
 * while maintaining aspect ratio
 *
 * @param {number} width - Original width of the image in pixels
 * @param {number} height - Original height of the image in pixels
 * @param {number} resizeTo - Maximum dimension to resize to (width or height) for the resized image
 * @returns {ImageDimensions} Object containing the new width and height
 */
export function calculateResizedDimensions(
  width: number,
  height: number,
  resizeTo: number,
): ImageDimensions {
  const isWidthLonger: boolean = width >= height
  const scaleFactor: number = isWidthLonger ? resizeTo / width : resizeTo / height
  const newWidth: number = Math.round(width * scaleFactor)
  const newHeight: number = Math.round(height * scaleFactor)

  return {
    width: newWidth,
    height: newHeight,
  }
}
