import { env } from "../config/env";
import { openai } from "../config/openai";

const llm = env.OPENAI_LLM;

/**
 * Generates a complete, non-streaming response for a plain text prompt.
 *
 * @param message - User prompt sent to the configured language model.
 * @returns The model's combined output text.
 */
export async function generateAnswer(message: string): Promise<string> {
    const response = await openai.responses.create({
        model: llm,
        input: message
    })

    return response.output_text;
}

/**
 * Starts a streaming language-model response.
 *
 * @param message - User prompt sent to the configured language model.
 * @param signal - Optional abort signal for timeout or disconnect cancellation.
 * @returns An asynchronous stream of OpenAI response events.
 */
export async function generateAnswerStream(message: string, signal?: AbortSignal) {
    const stream = await openai.responses.create({
        model: llm,
        input: message,
        stream: true,
    }, { signal })

    return stream;
}
