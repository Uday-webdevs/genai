import { env } from "../config/env";
import { searchChunksByVector } from "../repositories/rag.repository";
import type { RetrievedChunk } from "../types/rag";
import { embedTexts } from "./embedding.service";

/**
 * Embeds a natural-language query and retrieves its nearest ready chunks from
 * the configured Atlas Vector Search index.
 *
 * @param question - Query text used to find relevant document evidence.
 * @returns Similar chunks ordered by vector-search relevance.
 */
export async function retrieveRelevantChunks(
    question: string,
): Promise<RetrievedChunk[]> {
    console.log("retrieveRelevantChunks", question)
    const [queryVector] = await embedTexts([question]);

    return searchChunksByVector(
        queryVector,
        env.RAG_TOP_K,
        env.RAG_NUM_CANDIDATES,
        env.RAG_VECTOR_INDEX,
    );
}
