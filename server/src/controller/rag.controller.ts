import type { Request, Response } from "express";
import { open, unlink } from "node:fs/promises";
import { basename, extname } from "node:path";
import { z } from "zod";

import { getRagStats } from "../repositories/rag.repository";
import { answerWithRag } from "../services/rag.service";
import { ingestPdf } from "../services/ingestion.service";

const ragChatSchema = z.object({
    message: z
        .string()
        .trim()
        .min(1, "Message is required.")
        .max(2_000, "Message is too long."),
    history: z
        .array(
            z.object({
                role: z.enum(["user", "assistant"]),
                content: z.string().trim().min(1).max(4_000),
            }),
        )
        .max(8)
        .default([]),
});

/**
 * Handles a grounded chat request against the indexed document collection.
 *
 * @param req - Express request containing `message` and optional chat `history`.
 * @param res - Express response receiving the RAG answer or an error payload.
 */
export async function ragChat(
    req: Request,
    res: Response,
) {
    const parsed = ragChatSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
            error: "Invalid request",
            details: z.flattenError(parsed.error),
        });
    }

    try {
        const result = await answerWithRag(
            parsed.data.message,
            parsed.data.history,
        );
        return res.status(200).json(result);
    } catch (error: unknown) {
        console.error("RAG chat failed:", error);
        return res.status(502).json({
            error: "The knowledge assistant is temporarily unavailable.",
        });
    }
}

/**
 * Reports indexed document and chunk counts for knowledge-base status displays.
 *
 * @param _req - Express request; this endpoint does not consume request data.
 * @param res - Express response receiving the current RAG statistics.
 */
export async function ragStatus(
    _req: Request,
    res: Response,
) {
    try {
        const stats = await getRagStats();
        return res.status(200).json(stats);
    } catch (error: unknown) {
        console.error("RAG status failed:", error);
        return res.status(503).json({
            error: "The knowledge base is unavailable.",
        });
    }
}

/**
 * Converts an uploaded filename into a readable fallback document title.
 *
 * @param originalName - Original client-side filename.
 * @returns A normalized title without the extension.
 */
function defaultDocumentTitle(originalName: string): string {
    return basename(originalName, extname(originalName))
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200);
}

/**
 * Verifies the PDF magic bytes instead of trusting MIME type and extension.
 *
 * @param filePath - Local upload path to inspect.
 * @returns `true` when the file starts with the `%PDF-` signature.
 */
async function hasPdfSignature(filePath: string): Promise<boolean> {
    const file = await open(filePath, "r");

    try {
        const signature = Buffer.alloc(5);
        const { bytesRead } = await file.read(signature, 0, 5, 0);
        return bytesRead === 5 && signature.toString("ascii") === "%PDF-";
    } finally {
        await file.close();
    }
}

/**
 * Best-effort cleanup for an upload that should not remain on disk.
 *
 * @param filePath - Local upload path to remove.
 */
async function removeUploadedFile(filePath: string): Promise<void> {
    await unlink(filePath).catch(() => undefined);
}

/**
 * Validates and ingests one PDF uploaded by `acceptSinglePdf`.
 *
 * @param req - Express request containing the uploaded file and optional title.
 * @param res - Express response receiving ingestion metadata or validation errors.
 */
export async function uploadRagDocument(
    req: Request,
    res: Response,
) {
    if (!req.file) {
        return res.status(400).json({
            error: "A PDF file is required.",
        });
    }

    const uploadedPath = req.file.path;

    try {
        if (!(await hasPdfSignature(uploadedPath))) {
            await removeUploadedFile(uploadedPath);
            return res.status(415).json({
                error: "The uploaded file is not a valid PDF.",
            });
        }

        const requestedTitle =
            typeof req.body.title === "string"
                ? req.body.title.trim().slice(0, 200)
                : "";
        const title =
            requestedTitle || defaultDocumentTitle(req.file.originalname);

        const result = await ingestPdf({
            filePath: uploadedPath,
            title: title || "Uploaded PDF",
        });

        if (result.status === "skipped") {
            await removeUploadedFile(uploadedPath);
        }

        return res.status(result.status === "ingested" ? 201 : 200).json({
            ...result,
            title,
            sourceName: req.file.originalname,
        });
    } catch (error: unknown) {
        await removeUploadedFile(uploadedPath);
        console.error("PDF ingestion failed:", error);

        return res.status(422).json({
            error:
                error instanceof Error
                    ? error.message
                    : "The PDF could not be indexed.",
        });
    }
}
