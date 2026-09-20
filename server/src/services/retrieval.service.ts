import { env } from "../config/env";
import { searchChunksByVector } from "../repositories/rag.repository";
import type { RetrievedChunk } from "../types/rag";
import { embedTexts } from "./embedding.service";

export async function retrieveRelevantChunks(
    question: string,
): Promise<RetrievedChunk[]> {
    const [queryVector] = await embedTexts([question]);

    return searchChunksByVector(
        queryVector,
        env.RAG_TOP_K,
        env.RAG_NUM_CANDIDATES,
        env.RAG_VECTOR_INDEX,
    );
}
