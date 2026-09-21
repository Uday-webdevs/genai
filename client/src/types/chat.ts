export type MessageRole = "user" | "assistant";

export interface IRagCitation {
  chunkId: string;
  documentId: string;
  title: string;
  pdfPageStart: number;
  pdfPageEnd: number;
  excerpt: string;
  retrievalScore: number;
}

export interface IRagAnswer {
  answer: string;
  grounded: boolean;
  citations: IRagCitation[];
}

export interface IRagStatus {
  readyDocuments: number;
  chunks: number;
  documents: IRagDocumentSummary[];
}

export interface IRagDocumentSummary {
  id: string;
  title: string;
  sourceName: string;
  status: "processing" | "ready" | "failed";
  pageCount: number;
  chunkCount: number;
  error?: string;
  updatedAt: string;
}

export interface IUploadResult {
  documentId: string;
  status: "ingested" | "skipped";
  pageCount: number;
  indexedPageCount: number;
  chunkCount: number;
  title: string;
  sourceName: string;
}

export interface IChatTurn {
  role: MessageRole;
  content: string;
}

export interface IChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  grounded?: boolean;
  citations?: IRagCitation[];
}
