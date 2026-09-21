import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import type { NextFunction, Request, Response } from "express";
import multer from "multer";

import { env } from "../config/env";

export const PDF_UPLOAD_DIRECTORY = resolve("data/uploads");

mkdirSync(PDF_UPLOAD_DIRECTORY, { recursive: true });

const storage = multer.diskStorage({
    destination: PDF_UPLOAD_DIRECTORY,
    filename: (_request, _file, callback) => {
        callback(null, `${randomUUID()}.pdf`);
    },
});

const upload = multer({
    storage,
    limits: {
        fileSize: env.RAG_MAX_UPLOAD_MB * 1024 * 1024,
        files: 1,
        fields: 1,
        parts: 2,
    },
    fileFilter: (_request, file, callback) => {
        const isPdf =
            file.mimetype === "application/pdf" &&
            file.originalname.toLowerCase().endsWith(".pdf");

        if (!isPdf) {
            callback(new Error("Only PDF files are supported."));
            return;
        }

        callback(null, true);
    },
});

/**
 * Express middleware that accepts one multipart PDF under the `file` field and
 * converts Multer validation errors into JSON HTTP responses.
 *
 * @param request - Incoming multipart request populated by Multer on success.
 * @param response - Express response used for upload validation failures.
 * @param next - Callback that transfers control after a valid upload.
 */
export function acceptSinglePdf(
    request: Request,
    response: Response,
    next: NextFunction,
): void {
    upload.single("file")(request, response, (error: unknown) => {
        if (!error) {
            next();
            return;
        }

        if (
            error instanceof multer.MulterError &&
            error.code === "LIMIT_FILE_SIZE"
        ) {
            response.status(413).json({
                error: `PDF must be ${env.RAG_MAX_UPLOAD_MB} MB or smaller.`,
            });
            return;
        }

        response.status(400).json({
            error:
                error instanceof Error
                    ? error.message
                    : "The PDF upload could not be processed.",
        });
    });
}
