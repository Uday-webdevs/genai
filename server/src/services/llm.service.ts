import { env } from "../config/env";
import { openai } from "../config/openai";

const llm = env.OPENAI_LLM;

export async function generateAnswer(message: string): Promise<string> {
    const response = await openai.responses.create({
        model: llm,
        input: message
    })

    return response.output_text;
}

export async function generateAnswerStream(message: string, signal?: AbortSignal) {
    const stream = await openai.responses.create({
        model: llm,
        input: message,
        stream: true,
    }, { signal })

    return stream;
}
