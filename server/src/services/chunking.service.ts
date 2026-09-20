import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { getEncoding } from "js-tiktoken";

import type { IBookChunk, IBookPage } from "../types/document";

export const CHUNKER_VERSION = "recursive-token-v1";

const tokenizer = getEncoding("cl100k_base");

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 450,
    chunkOverlap: 75,
    separators: ["\n\n", "\n", ". ", " ", ""],
    lengthFunction: (text) => tokenizer.encode(text).length,
});

export async function chunkPages(
    pages: IBookPage[],
): Promise<IBookChunk[]> {
    const chunks: IBookChunk[] = [];
    let chunkIndex = 0;

    for (const page of pages) {
        if (!page.text) continue;

        // Pages are split independently so every citation remains precise.
        const pageChunks = await splitter.splitText(page.text);

        for (const text of pageChunks) {
            const normalizedText = text.trim();

            if (!normalizedText) continue;

            const tokenCount = tokenizer.encode(normalizedText).length;

            chunks.push({
                chunkIndex,
                text: normalizedText,
                tokenCount,
                charCount: normalizedText.length,
                metadata: {
                    pdfPageStart: page.pdfPage,
                    pdfPageEnd: page.pdfPage,
                    bookPageStart: page.bookPage,
                    bookPageEnd: page.bookPage,
                    contentTypes:
                        page.contentTypes.length > 0
                            ? [...page.contentTypes]
                            : ["text"],
                },
            });

            chunkIndex += 1;
        }
    }

    return chunks;
}
