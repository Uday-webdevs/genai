import { chunkPages } from "../services/chunking.service";
import { extractPdfPages } from "../services/pdf.service";

async function main(): Promise<void> {
    const filePath =
        process.argv[2] ?? "data/books/10thScienceBook.pdf";

    const pages = await extractPdfPages(filePath);
    const chunks = await chunkPages(pages);

    console.log({
        pages: pages.length,
        emptyPages: pages.filter((page) => !page.text).length,
        chunks: chunks.length,
    });

    console.log(
        chunks.slice(0, 3).map((chunk) => ({
            chunkIndex: chunk.chunkIndex,
            pdfPage: chunk.metadata.pdfPageStart,
            tokenCount: chunk.tokenCount,
            preview: chunk.text.slice(0, 250),
        })),
    );
}

main().catch((error: unknown) => {
    console.error("Book inspection failed:", error);
    process.exitCode = 1;
});
