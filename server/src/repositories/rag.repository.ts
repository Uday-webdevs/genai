import type { Collection } from "mongodb";

import { getDatabase } from "../config/database";
import type {
  RagChunk,
  RagDocument,
  RagDocumentSummary,
  RetrievedChunk,
} from "../types/rag";

interface RagCollections {
  documents: Collection<RagDocument>;
  chunks: Collection<RagChunk>;
}

/**
 * Gets the typed MongoDB collections used by the RAG subsystem.
 *
 * @returns Handles for the document registry and vectorized chunk collection.
 */
export async function getRagCollections(): Promise<RagCollections> {
  const database = await getDatabase();

  return {
    documents: database.collection<RagDocument>("rag_documents"),
    chunks: database.collection<RagChunk>("rag_chunks"),
  };
}

/**
 * Creates the conventional MongoDB indexes required for document deduplication
 * and chunk lifecycle operations. The Atlas Vector Search index is managed
 * separately in Atlas.
 */
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

/**
 * Finds a previously registered source document by its content hash.
 *
 * @param sha256 - SHA-256 digest of the complete source file.
 * @returns The matching document, or `null` when it has not been registered.
 */
export async function findDocumentByHash(
  sha256: string,
): Promise<RagDocument | null> {
  const { documents } = await getRagCollections();
  return documents.findOne({ sha256 });
}

/**
 * Inserts or replaces a document registry record by its stable identifier.
 *
 * @param document - Complete document metadata and ingestion state to persist.
 */
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

/**
 * Bulk upserts document chunks by their stable chunk identifiers.
 *
 * @param ragChunks - Fully prepared chunks, including embeddings and metadata.
 */
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

/**
 * Removes leftover chunks after a document is re-ingested with fewer chunks.
 *
 * @param documentId - Identifier of the re-ingested document.
 * @param chunkCount - Number of chunks in the newest document version.
 */
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

/**
 * Runs Atlas Vector Search and returns chunks belonging only to documents whose
 * ingestion status is `ready`.
 *
 * @param queryVector - Embedding for the user's retrieval query.
 * @param limit - Maximum number of ready chunks to return.
 * @param numCandidates - Approximate nearest-neighbor candidates Atlas examines.
 * @param indexName - Name of the Atlas Vector Search index.
 * @returns Relevant chunks ordered by Atlas vector similarity.
 */
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

/**
 * Builds the knowledge-base status shown by the API and client.
 *
 * @returns Ready-document count, ready chunk count, and per-document summaries.
 */
export async function getRagStats(): Promise<{
  readyDocuments: number;
  chunks: number;
  documents: RagDocumentSummary[];
}> {
  const { documents, chunks } = await getRagCollections();
  const allDocuments = await documents
    .find(
      {},
      {
        projection: {
          title: 1,
          sourceName: 1,
          status: 1,
          pageCount: 1,
          chunkCount: 1,
          error: 1,
          updatedAt: 1,
        },
      },
    )
    .sort({ updatedAt: -1 })
    .toArray();
  const ready = allDocuments.filter(
    (document) => document.status === "ready",
  );
  const documentIds = ready.map((document) => document._id);

  return {
    readyDocuments: documentIds.length,
    chunks:
      documentIds.length === 0
        ? 0
        : await chunks.countDocuments({
            documentId: { $in: documentIds },
          }),
    documents: allDocuments.map((document) => ({
      id: document._id,
      title: document.title,
      sourceName: document.sourceName,
      status: document.status,
      pageCount: document.pageCount,
      chunkCount: document.chunkCount,
      ...(document.error ? { error: document.error } : {}),
      updatedAt: document.updatedAt,
    })),
  };
}
