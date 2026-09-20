import type { ContentType } from "./document";

export type DocumentStatus =
  | "processing"
  | "ready"
  | "failed";

export type ChunkContentType = ContentType;

export interface RagDocument {
  _id: string;
  title: string;
  sourceName: string;
  sourcePath: string;
  sha256: string;

  status: DocumentStatus;
  /** Total number of pages in the source PDF. */
  pageCount: number;
  indexedPageStart: number;
  indexedPageEnd: number;
  indexedPageCount: number;
  chunkCount: number;

  embeddingModel: string;
  chunkerVersion: string;

  error?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface RagChunk {
  /**
   * Stable citation ID, for example:
   * `${documentId}:${chunkIndex}`
   */
  _id: string;

  documentId: string;
  chunkIndex: number;
  text: string;

  embedding: number[];

  metadata: {
    title: string;
    sourceName: string;
    pdfPageStart: number;
    pdfPageEnd: number;
    bookPageStart: number | null;
    bookPageEnd: number | null;
    contentTypes: ChunkContentType[];
  };

  tokenCount: number;
  charCount: number;
  textHash: string;

  embeddingModel: string;
  chunkerVersion: string;
  createdAt: Date;
}

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  text: string;
  score: number;
  metadata: RagChunk["metadata"];
}

export interface RagCitation {
  chunkId: string;
  documentId: string;
  title: string;
  pdfPageStart: number;
  pdfPageEnd: number;
  excerpt: string;
  retrievalScore: number;
}

export interface RagAnswer {
  answer: string;
  grounded: boolean;
  citations: RagCitation[];
}
