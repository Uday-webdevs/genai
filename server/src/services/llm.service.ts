import OpenAI from "openai";
import { env } from "../config/env";

const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY
})
const llm = "gpt-4o-mini";

export async function generateAnswer(message: string): Promise<string> {
    const response = await client.responses.create({
        model: llm,
        input: message
    })

    return response.output_text;
}

export async function generateAnswerStream(message: string, signal?: AbortSignal) {
    const stream = await client.responses.create({
        model: llm,
        input: message,
        stream: true,
    }, { signal })

    return stream;
}
