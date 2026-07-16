import mongoose, { type Mongoose } from "mongoose";

/**
 * Serverless-safe MongoDB connection.
 *
 * In dev, Next.js hot-reloads modules on every edit; in production serverless
 * each invocation may reuse a warm container. Either way, naively calling
 * `mongoose.connect()` per request opens a new socket every time and quickly
 * exhausts the Atlas connection pool. We cache the connection promise on
 * `globalThis` so it survives module reloads and is shared across invocations.
 */

interface MongooseCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache =
  globalThis.__mongooseCache ?? { conn: null, promise: null };

globalThis.__mongooseCache = cache;

export async function connectToDatabase(): Promise<Mongoose> {
  if (cache.conn) return cache.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Copy .env.example to .env and add your MongoDB Atlas connection string.",
    );
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, {
      // Pin the database explicitly so it doesn't depend on the URI path
      // (the provided Atlas string has no database segment).
      dbName: process.env.MONGODB_DB_NAME ?? "bytex-ledger",
      // Fail fast with a clear error instead of hanging if Atlas is unreachable.
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 10,
      // Our app stores money as integer cents; strict mode prevents silent
      // schema drift from unexpected fields.
      bufferCommands: false,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    // Reset so the next request can retry rather than reusing a rejected promise.
    cache.promise = null;
    throw err;
  }

  return cache.conn;
}
