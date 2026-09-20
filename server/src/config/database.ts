import { Db, MongoClient } from "mongodb";

import { env } from "./env";

const client = new MongoClient(env.MONGODB_URI, {
    maxPoolSize: 20,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 5_000,
});

let connectionPromise: Promise<MongoClient> | undefined;

export async function getDatabase(): Promise<Db> {
    connectionPromise ??= client.connect();

    const connectedClient = await connectionPromise;
    return connectedClient.db(env.MONGODB_DB);
}

export async function closeDatabase(): Promise<void> {
    if (!connectionPromise) return;

    await client.close();
}
