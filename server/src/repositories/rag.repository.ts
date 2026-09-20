import type { Collection } from "mongodb";

import { getDatabase } from "../config/database";
import type {
  RagChunk,
  RagDocument,
  RetrievedChunk,
} from "../types/rag";

interface RagCollections {
  documents: Collection<RagDocument>;
  chunks: Collection<RagChunk>;
}

export async function getRagCollections(): Promise<RagCollections> {
  const database = await getDatabase();

  return {
    documents: database.collection<RagDocument>("rag_documents"),
    chunks: database.collection<RagChunk>("rag_chunks"),
  };
}

export async function ensureRagIndexes(): Promise<void> {
  const { documents, chunks } = await getRagCollections();

  await Promise.all([
    documents.createIndex(
      { sha256: 1 },
      {
        unique: true,
        name: "unique_document_sha256",
      },
    ),

    chunks.createIndex(
      { documentId: 1, chunkIndex: 1 },
      {
        unique: true,
        name: "unique_document_chunk",
      },
    ),

    chunks.createIndex(
      { documentId: 1 },
      {
        name: "chunks_by_document",
      },
    ),
  ]);
}

export async function findDocumentByHash(
  sha256: string,
): Promise<RagDocument | null> {
  const { documents } = await getRagCollections();
  return documents.findOne({ sha256 });
}

export async function saveDocument(
  document: RagDocument,
): Promise<void> {
  const { documents } = await getRagCollections();

  await documents.replaceOne(
    { _id: document._id },
    document,
    { upsert: true },
  );
}

export async function upsertChunks(
  ragChunks: RagChunk[],
): Promise<void> {
  if (ragChunks.length === 0) return;

  const { chunks } = await getRagCollections();

  await chunks.bulkWrite(
    ragChunks.map((chunk) => ({
      replaceOne: {
        filter: { _id: chunk._id },
        replacement: chunk,
        upsert: true,
      },
    })),
    { ordered: false },
  );
}

export async function deleteStaleChunks(
  documentId: string,
  chunkCount: number,
): Promise<void> {
  const { chunks } = await getRagCollections();

  await chunks.deleteMany({
    documentId,
    chunkIndex: { $gte: chunkCount },
  });
}

interface VectorSearchResult {
  _id: string;
  documentId: string;
  text: string;
  score: number;
  metadata: RagChunk["metadata"];
}

export async function searchChunksByVector(
  queryVector: number[],
  limit: number,
  numCandidates: number,
  indexName: string,
): Promise<RetrievedChunk[]> {
  const { chunks } = await getRagCollections();

  // Retrieve extra candidates before checking document status so a failed or
  // processing document cannot crowd ready content out of the final results.
  const vectorLimit = Math.min(numCandidates, limit * 3);
  const results = await chunks
    .aggregate<VectorSearchResult>([
      {
        $vectorSearch: {
          index: indexName,
          path: "embedding",
          queryVector,
          numCandidates,
          limit: vectorLimit,
        },
      },
      {
        $project: {
          documentId: 1,
          text: 1,
          metadata: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
      {
        $lookup: {
          from: "rag_documents",
          localField: "documentId",
          foreignField: "_id",
          as: "document",
        },
      },
      { $match: { "document.status": "ready" } },
      { $limit: limit },
      { $unset: "document" },
    ])
    .toArray();

  return results.map((result) => ({
    chunkId: result._id,
    documentId: result.documentId,
    text: result.text,
    score: result.score,
    metadata: result.metadata,
  }));
}

export async function getRagStats(): Promise<{
  readyDocuments: number;
  chunks: number;
}> {
  const { documents, chunks } = await getRagCollections();
  const ready = await documents
    .find(
      { status: "ready" },
      { projection: { _id: 1 } },
    )
    .toArray();
  const documentIds = ready.map((document) => document._id);

  return {
    readyDocuments: documentIds.length,
    chunks:
      documentIds.length === 0
        ? 0
        : await chunks.countDocuments({
            documentId: { $in: documentIds },
          }),
  };
}
