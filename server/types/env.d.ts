// Pull the wrangler-generated binding types (Env, D1Database, R2Bucket,
// ImagesBinding, ...) into the server compilation. Nuxt's server tsconfig only
// includes `server/**/*`, so this root-level file needs an explicit reference
// for those globals to resolve in server routes/utils.
/// <reference path="../../worker-configuration.d.ts" />
