import dotenv from "dotenv";
import { z } from "zod";

dotenv.config()

const envSchema = z.object({
    NODE_ENV: z
        .enum(["development", "test", "production"])
        .default("development"),
    PORT: z.coerce.number().default(3000),
    CORS_ORIGIN: z.url().default("http://localhost:5173"),

    OPENAI_API_KEY: z.string().min(1),
    OPENAI_LLM: z.string().min(1),
    OPENAI_EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-small"),
    OPENAI_EMBEDDING_DIMENSIONS: z.coerce
        .number()
        .int()
        .min(1)
        .default(1536),

    MONGODB_URI: z.string().min(1),
    MONGODB_DB: z.string().min(1).default("genai_rag"),

    RAG_VECTOR_INDEX: z.string().min(1).default("rag_vector_index"),
    RAG_TOP_K: z.coerce.number().int().min(1).max(20).default(7),
    RAG_NUM_CANDIDATES: z.coerce.number().int().min(10).max(1000).default(100),
    RAG_EMBEDDING_BATCH_SIZE: z.coerce
        .number()
        .int()
        .min(1)
        .max(256)
        .default(64),
})
.superRefine((value, context) => {
    if (value.RAG_NUM_CANDIDATES < value.RAG_TOP_K) {
        context.addIssue({
            code: "custom",
            path: ["RAG_NUM_CANDIDATES"],
            message: "RAG_NUM_CANDIDATES must be >= RAG_TOP_K",
        })
    }
})

const result = envSchema.safeParse(process.env);

if (!result.success) {
    throw new Error(
        `Invalid environment configuration: ${JSON.stringify(z.flattenError(result.error))}`,
    )
}

export const env = result.data;
