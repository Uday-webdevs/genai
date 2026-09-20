import { closeDatabase } from "../config/database";
import { ensureRagIndexes } from "../repositories/rag.repository";
import { ingestPdf } from "../services/ingestion.service";

interface CliOptions {
    filePath: string;
    title: string;
    startPdfPage: number;
    endPdfPage?: number;
    force: boolean;
}

function readValue(args: string[], flag: string): string | undefined {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
}

function parsePositiveInteger(
    value: string | undefined,
    fallback: number | undefined,
    flag: string,
): number | undefined {
    if (value === undefined) return fallback;

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error(`${flag} must be a positive integer.`);
    }

    return parsed;
}

function parseOptions(): CliOptions {
    const args = process.argv.slice(2);
    const positionalPath =
        args[0] && !args[0].startsWith("--")
            ? args[0]
            : undefined;

    return {
        filePath:
            readValue(args, "--file") ??
            positionalPath ??
            "data/books/10thScienceBook.pdf",
        title:
            readValue(args, "--title") ??
            "Science and Technology, Standard Ten, Part 1",
        // This specific PDF has cover, publishing and contents pages first.
        startPdfPage:
            parsePositiveInteger(
                readValue(args, "--start-page"),
                11,
                "--start-page",
            ) ?? 11,
        endPdfPage: parsePositiveInteger(
            readValue(args, "--end-page"),
            undefined,
            "--end-page",
        ),
        force: args.includes("--force"),
    };
}

async function main(): Promise<void> {
    const options = parseOptions();
    await ensureRagIndexes();

    const result = await ingestPdf({
        ...options,
        onEmbeddingProgress: ({ completed, total }) => {
            console.log(`Embedded ${completed}/${total} chunks`);
        },
    });

    console.log("Book ingestion complete:", result);
}

main()
    .catch((error: unknown) => {
        console.error("Book ingestion failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDatabase();
    });
