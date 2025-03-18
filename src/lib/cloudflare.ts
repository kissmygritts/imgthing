import os from "os"
import path from "path"
import { exists } from "node:fs/promises"
import {
  S3Client,
  ListBucketsCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3"

interface R2Configuration {
  bucket?: string
  token: string
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
  region: string
}

const CONFIG_FILE_PATHS = [
  path.join(os.homedir(), ".config", ".r2config.json"),
  path.join(os.homedir(), ".r2config.json"),
]

export async function listObjects(bucket: string) {
  const config = await getR2Configuration()
  const r2 = makeR2Client(config)
  const command = new ListObjectsV2Command({ Bucket: bucket })

  return r2.send(command)
}

export async function listBuckets() {
  const config = await getR2Configuration()
  const r2 = makeR2Client(config)
  const command = new ListBucketsCommand({})

  return r2.send(command)
}

export async function getR2Configuration(configFile: string = ""): Promise<R2Configuration> {
  const configPaths = configFile === "" ? CONFIG_FILE_PATHS : [configFile]
  const existIndex = await configPaths.findIndex(exists)
  const config: R2Configuration = await Bun.file(configPaths[existIndex]).json()

  return config
}

export function makeR2Client(config: R2Configuration) {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
}
