import { mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "path"

/**
 * Creates a directory if it does not already exist.
 * Supports both synchronous and asynchronous execution in Bun.
 *
 * @param dirPath - The path of the directory to create.
 * @param recursive - Whether to create parent directories if they don't exist (default: true).
 * @returns A promise that resolves when the directory is created or rejects with an error.
 */
export async function makeDirectory(dirPath: string, recursive: boolean = true): Promise<void> {
  dirPath = path.resolve(dirPath)
  const dirExists = existsSync(dirPath)

  try {
    if (!dirExists) {
      await mkdir(dirPath, { recursive })
    }
  } catch (error) {
    console.error(`❌ Error creating directory '${dirPath}':`, error)
    throw error
  }
}

/**
 * Camel-case a string.
 */
export function camelize(str: string) {
  return str.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, function (match, index) {
    if (+match === 0) return "" // or if (/\s+/.test(match)) for white spaces
    return index === 0 ? match.toLowerCase() : match.toUpperCase()
  })
}
