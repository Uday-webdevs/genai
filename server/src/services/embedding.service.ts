import { env } from "../config/env";
import { openai } from "../config/openai";

export interface EmbeddingProgress {
    completed: number;
    total: number;
}

/**
 * Embeds text in bounded batches while preserving the input order.
 *
 * @param texts - Non-empty strings to convert into embedding vectors.
 * @param onProgress - Optional callback invoked after each completed batch.
 * @returns One validated embedding vector for each input string.
 * @throws When text is empty or the provider returns an unexpected result shape.
 */
export async function embedTexts(
    texts: string[],
    onProgress?: (progress: EmbeddingProgress) => void,
): Promise<number[][]> {
    if (texts.some((text) => text.trim().length === 0)) {
        throw new Error("Cannot create an embedding for empty text.");
    }

    const embeddings: number[][] = [];

    for (
        let offset = 0;
        offset < texts.length;
        offset += env.RAG_EMBEDDING_BATCH_SIZE
    ) {
        const batch = texts.slice(
            offset,
            offset + env.RAG_EMBEDDING_BATCH_SIZE,
        );

        const response = await openai.embeddings.create({
            model: env.OPENAI_EMBEDDING_MODEL,
            input: batch,
            encoding_format: "float",
            dimensions: env.OPENAI_EMBEDDING_DIMENSIONS,
        });

        const ordered = [...response.data].sort(
            (left, right) => left.index - right.index,
        );

        if (ordered.length !== batch.length) {
            throw new Error(
                `Expected ${batch.length} embeddings but received ${ordered.length}.`,
            );
        }

        for (const result of ordered) {
            if (
                result.embedding.length !==
                env.OPENAI_EMBEDDING_DIMENSIONS
            ) {
                throw new Error(
                    `Expected ${env.OPENAI_EMBEDDING_DIMENSIONS} embedding dimensions but received ${result.embedding.length}.`,
                );
            }

            embeddings.push(result.embedding);
        }

        onProgress?.({
            completed: embeddings.length,
            total: texts.length,
        });
    }

    return embeddings;
}
