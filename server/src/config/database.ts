import { Db, MongoClient } from "mongodb";

import { env } from "./env";

const client = new MongoClient(env.MONGODB_URI, {
    maxPoolSize: 20,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 5_000,
});

let connectionPromise: Promise<MongoClient> | undefined;

/**
 * Returns the configured application database, reusing a single MongoDB
 * connection promise across callers.
 *
 * @returns The connected MongoDB database handle.
 */
export async function getDatabase(): Promise<Db> {
    connectionPromise ??= client.connect();

    const connectedClient = await connectionPromise;
    return connectedClient.db(env.MONGODB_DB);
}

/**
 * Closes the shared MongoDB client when a connection has been opened.
 * Intended for graceful shutdown and one-off scripts.
 */
export async function closeDatabase(): Promise<void> {
    if (!connectionPromise) return;

    await client.close();
}
