import { readFile } from "node:fs/promises";

import type { IBookPage } from "../types/document";

export async function extractPdfPages(
    filePath: string,
): Promise<IBookPage[]> {
    const file = await readFile(filePath);

    // pdfjs-dist is ESM-only, while this project currently emits CommonJS.
    const { getDocument } = await import(
        "pdfjs-dist/legacy/build/pdf.mjs"
    );

    const loadingTask = getDocument({
        data: new Uint8Array(file),
        useSystemFonts: true,
    });

    try {
        const pdf = await loadingTask.promise;
        const pages: IBookPage[] = [];

        for (
            let pdfPage = 1;
            pdfPage <= pdf.numPages;
            pdfPage += 1
        ) {
            const page = await pdf.getPage(pdfPage);
            const content = await page.getTextContent();

            const text = content.items
                .filter(
                    (item): item is typeof item & { str: string } =>
                        "str" in item,
                )
                .map((item) => item.str)
                .join(" ")
                .replace(/\s+/g, " ")
                .trim();

            pages.push({
                pdfPage,
                // We keep citations accurate and avoid guessing printed pages.
                bookPage: null,
                text,
                contentTypes: text ? ["text"] : [],
                charCount: text.length,
            });

            page.cleanup();
        }

        return pages;
    } finally {
        await loadingTask.destroy();
    }
}
