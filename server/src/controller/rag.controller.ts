import type { Request, Response } from "express";
import { z } from "zod";

import { getRagStats } from "../repositories/rag.repository";
import { answerWithRag } from "../services/rag.service";

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
