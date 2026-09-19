import { z } from "zod";

export const supportAnalysisSchema = z.object({
    category: z.enum([
        "billing",
        "technical",
        "account",
        "general"
    ]),
    priority: z.enum([
        "low",
        "medium",
        "high"
    ]),
    requiresHuman: z.boolean(),
    summary: z.string().min(1),
})

export type SupportAnalysis = z.infer<typeof supportAnalysisSchema>;
