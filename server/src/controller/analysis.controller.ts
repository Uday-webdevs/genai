import { Request, Response } from "express";
import { z } from "zod";

import { generateSupportAnalysis } from "../services/analysis.service";

const analyzeSchema = z.object({
    message: z
        .string()
        .trim()
        .min(1, "Message is required.")
        .max(10_000, "Message is too long.")
})

export async function analyzeSupportRequest(
    req: Request,
    res: Response
) {
    const parsedMessage = analyzeSchema.safeParse(req.body);

    if (!parsedMessage.success) {
        return res.status(400).json({
            error: "Invalid request",
            details: z.flattenError(parsedMessage.error)
        })
    }

    try {
        const analysis = await generateSupportAnalysis(parsedMessage.data.message);

        return res.status(200).json({
            analysis
        })
    } catch (err) {
        console.error("Analysis LLM request failed:", err)

        return res.status(502).json({
            error: "Analysis AI service temporarily not available"
        })
    }    
}
