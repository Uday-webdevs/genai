import OpenAI from "openai"
import { zodTextFormat } from "openai/helpers/zod.js";

import { env } from "../config/env"
import { supportAnalysisSchema } from "../schemas/ai.schema";

const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY
})
const llm = env.OPENAI_LLM;

export async function generateSupportAnalysis(message: string) {
    const response = await client.responses.parse({
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
