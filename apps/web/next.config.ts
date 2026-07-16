import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

// In a monorepo, Next only auto-loads .env from the app directory. Our secrets
// live in the repo-root .env, so load them here before the server starts.
const appDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(appDir, "../../.env") });

const nextConfig: NextConfig = {
  // Internal monorepo packages ship as TypeScript source and are transpiled by Next.
  transpilePackages: ["@repo/core", "@repo/db", "@repo/ai"],
  // mongoose ships optional native/dynamic deps; keep it external to the server bundle.
  serverExternalPackages: ["mongoose"],
};

export default nextConfig;
