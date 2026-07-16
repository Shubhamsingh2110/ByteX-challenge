import mongoose, { type Connection } from "mongoose";

/**
 * Serverless-safe MongoDB connection.
 *
 * We use an explicit `createConnection` (not the global `mongoose.connect`) and
 * bind models to the returned `Connection` object (see models.ts). This is the
 * reliable pattern under a bundler like Next.js: the global default connection
 * can end up decoupled from where models are registered, which makes every
 * operation buffer and then time out ("buffering timed out after 10000ms").
 * Binding the model to the exact connection we awaited eliminates that.
 *
 * The connection is cached on `globalThis` so it survives dev hot-reloads and is
 * shared across serverless invocations instead of opening a socket per request.
 */

interface ConnCache {
  conn: Connection | null;
  promise: Promise<Connection> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __mongoConn: ConnCache | undefined;
}

const cache: ConnCache = globalThis.__mongoConn ?? { conn: null, promise: null };
globalThis.__mongoConn = cache;

export async function getConnection(): Promise<Connection> {
  if (cache.conn && cache.conn.readyState === 1) return cache.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Copy .env.example to .env and add your MongoDB Atlas connection string.",
    );
  }

  if (!cache.promise) {
    const connection = mongoose.createConnection(uri, {
      dbName: process.env.MONGODB_DB_NAME ?? "bytex-ledger",
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 10,
      // Fail fast instead of buffering if an op ever runs before connect.
      bufferCommands: false,
    });
    cache.promise = connection.asPromise();
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }

  return cache.conn;
}
