import type { Collection } from "mongodb";

import { getDatabase } from "../config/database";
import type { RagChunk, RagDocument } from "../types/rag";

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
