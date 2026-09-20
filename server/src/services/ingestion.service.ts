import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { basename, relative, resolve } from "node:path";

import { env } from "../config/env";
import {
    deleteStaleChunks,
    findDocumentByHash,
    saveDocument,
    upsertChunks,
} from "../repositories/rag.repository";
import type { RagChunk, RagDocument } from "../types/rag";
import {
    CHUNKER_VERSION,
    chunkPages,
} from "./chunking.service";
import { embedTexts, type EmbeddingProgress } from "./embedding.service";
import { extractPdfPages } from "./pdf.service";

export interface IngestPdfInput {
    filePath: string;
    title: string;
    startPdfPage?: number;
    endPdfPage?: number;
    force?: boolean;
    onEmbeddingProgress?: (progress: EmbeddingProgress) => void;
}

export interface IngestPdfResult {
    documentId: string;
    status: "ingested" | "skipped";
    pageCount: number;
    indexedPageCount: number;
    chunkCount: number;
}

async function sha256File(filePath: string): Promise<string> {
    return new Promise((resolveHash, reject) => {
        const hash = createHash("sha256");
        const stream = createReadStream(filePath);

        stream.on("data", (data) => hash.update(data));
        stream.on("error", reject);
        stream.on("end", () => resolveHash(hash.digest("hex")));
    });
}

function sha256Text(text: string): string {
    return createHash("sha256").update(text).digest("hex");
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export async function ingestPdf(
    input: IngestPdfInput,
): Promise<IngestPdfResult> {
    if (!input.title.trim()) {
        throw new Error("A document title is required.");
    }

    const absolutePath = resolve(input.filePath);
    const sha256 = await sha256File(absolutePath);
    const existing = await findDocumentByHash(sha256);

    if (existing?.status === "ready" && !input.force) {
        return {
            documentId: existing._id,
            status: "skipped",
            pageCount: existing.pageCount,
            indexedPageCount: existing.indexedPageCount,
            chunkCount: existing.chunkCount,
        };
    }

    const pages = await extractPdfPages(absolutePath);
    const startPdfPage = input.startPdfPage ?? 1;
    const endPdfPage = input.endPdfPage ?? pages.length;

    if (
        !Number.isInteger(startPdfPage) ||
        !Number.isInteger(endPdfPage) ||
        startPdfPage < 1 ||
        endPdfPage > pages.length ||
        startPdfPage > endPdfPage
    ) {
        throw new Error(
            `Invalid PDF page range ${startPdfPage}-${endPdfPage}; the document has ${pages.length} pages.`,
        );
    }

    const indexedPages = pages.filter(
        (page) =>
            page.pdfPage >= startPdfPage &&
            page.pdfPage <= endPdfPage,
    );
    const chunks = await chunkPages(indexedPages);

    if (chunks.length === 0) {
        throw new Error("The selected PDF pages produced no text chunks.");
    }

    const now = new Date();
    const documentId = existing?._id ?? randomUUID();
    const sourceName = basename(absolutePath);
    const sourcePath = relative(process.cwd(), absolutePath).replaceAll("\\", "/");

    const document: RagDocument = {
        _id: documentId,
        title: input.title.trim(),
        sourceName,
        sourcePath,
        sha256,
        status: "processing",
        pageCount: pages.length,
        indexedPageStart: startPdfPage,
        indexedPageEnd: endPdfPage,
        indexedPageCount: indexedPages.length,
        chunkCount: 0,
        embeddingModel: env.OPENAI_EMBEDDING_MODEL,
        chunkerVersion: CHUNKER_VERSION,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
    };

    await saveDocument(document);

    try {
        const embeddings = await embedTexts(
            chunks.map((chunk) => chunk.text),
            input.onEmbeddingProgress,
        );
        const createdAt = new Date();

        const ragChunks: RagChunk[] = chunks.map((chunk, index) => ({
            _id: `${documentId}:${chunk.chunkIndex}`,
            documentId,
            chunkIndex: chunk.chunkIndex,
            text: chunk.text,
            embedding: embeddings[index],
            metadata: {
                title: document.title,
                sourceName,
                ...chunk.metadata,
            },
            tokenCount: chunk.tokenCount,
            charCount: chunk.charCount,
            textHash: sha256Text(chunk.text),
            embeddingModel: env.OPENAI_EMBEDDING_MODEL,
            chunkerVersion: CHUNKER_VERSION,
            createdAt,
        }));

        await upsertChunks(ragChunks);
        await deleteStaleChunks(documentId, ragChunks.length);

        const readyDocument: RagDocument = {
            ...document,
            status: "ready",
            chunkCount: ragChunks.length,
            updatedAt: new Date(),
        };
        await saveDocument(readyDocument);

        return {
            documentId,
            status: "ingested",
            pageCount: pages.length,
            indexedPageCount: indexedPages.length,
            chunkCount: ragChunks.length,
        };
    } catch (error: unknown) {
        await saveDocument({
            ...document,
            status: "failed",
            error: errorMessage(error).slice(0, 2_000),
            updatedAt: new Date(),
        });

        throw error;
    }
}
