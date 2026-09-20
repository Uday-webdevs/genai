export type ContentType =
    | "text"
    | "equation"
    | "table"
    | "question"
    | "activity"
    | "example"
    | "image";

export interface IBookPage {
    pdfPage: number;
    bookPage: number | null;
    text: string;
    contentTypes: ContentType[];
    charCount: number;
}

export interface IBookChunk {
    chunkIndex: number;
    text: string;
    tokenCount: number;
    charCount: number;

    metadata: {
        pdfPageStart: number;
        pdfPageEnd: number;
        bookPageStart: number | null;
        bookPageEnd: number | null;
        contentTypes: ContentType[];
    };
}
