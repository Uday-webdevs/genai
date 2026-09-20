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
