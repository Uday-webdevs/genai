import app from "./app";
import { env } from "./config/env";

import { closeDatabase, getDatabase } from "./config/database";
import { ensureRagIndexes } from "./repositories/rag.repository";

async function bootstrap(): Promise<void> {
    await getDatabase();
    await ensureRagIndexes();

    const server = app.listen(
        env.PORT,
        () => console.log(`Server running on port ${env.PORT}`)
    )

    async function shutdown(signal: string): Promise<void> {
        console.log(`${signal} received. Shutting down.`);

        server.close(async () => {
            await closeDatabase();
            process.exit(0);
        })

        setTimeout(() => {
            console.error("Forced shutdown after timeout.");
            process.exit(1);
        }, 10_000).unref();
    }

    process.once("SIGINT", () => {
        void shutdown("SIGINT")
    })

    process.once("SIGTERM", () => {
        void shutdown("SIGTERM")
    })
}

bootstrap().catch((error: unknown) => {
    console.error("Failed to start server:", error);
    process.exit(1);
})
