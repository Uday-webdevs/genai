import { zodTextFormat } from "openai/helpers/zod.js";

import { env } from "../config/env"
import { openai } from "../config/openai";
import { supportAnalysisSchema } from "../schemas/ai.schema";

const llm = env.OPENAI_LLM;

/**
 * Classifies and summarizes a customer-support message into the validated
 * structured support-analysis schema.
 *
 * @param message - Customer-support request to analyze.
 * @returns Parsed structured analysis, or `null` if no parsed output is present.
 */
export async function generateSupportAnalysis(message: string) {
    const response = await openai.responses.parse({
        model: llm,
        input: [
            {
                role: "system",
                content: "Analyse customer support requests."
            },
            {
                role: "user",
                content: message
            }
        ],
        text: {
            format: zodTextFormat(
                supportAnalysisSchema,
                "support_analysis"
            )
        }
    })

    return response.output_parsed;
}
