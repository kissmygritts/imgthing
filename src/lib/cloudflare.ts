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
import { NodeHttpHandler } from "@aws-sdk/node-http-handler"
import { spawnSync } from "bun"

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
  const response = await listObjectsWithS3Cli(bucket, config.endpoint, "cloudflare")
  const objects = response.Contents

  return objects
}

export async function listBuckets() {
  const config = await getR2Configuration()
  const r2 = makeR2Client(config)
  const command = new ListBucketsCommand({})
  const response = await r2.send(command)

  return response
}

async function listObjectsWithS3Cli(bucket: string, endpoint: string, profile: string = "default") {
  const config = await getR2Configuration()
  const proc = spawnSync([
    "aws",
    "s3api",
    "list-objects-v2",
    "--bucket",
    bucket,
    "--endpoint-url",
    endpoint,
    "--profile",
    profile,
  ])

  if (proc.exitCode != 0) {
    console.error("CLI returned error: ", proc.stderr?.toString())
    return null
  }

  return JSON.parse(proc.stdout?.toString()) || {}
}

export async function getR2Configuration(configFile: string = ""): Promise<R2Configuration> {
  const configPaths = configFile === "" ? CONFIG_FILE_PATHS : [configFile]
  let configPath = ""
  for (const config of configPaths) {
    if (await exists(config)) {
      configPath = config
      break
    }
  }

  const config: R2Configuration = await Bun.file(configPath).json()

  return config
}

export function makeR2Client(config: R2Configuration) {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: true,
    requestHandler: new NodeHttpHandler({
      requestTimeout: 5_000,
    }),
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
}
