import dotenv from "dotenv";
import { z } from "zod";

dotenv.config()

const envSchema = z.object({
    PORT: z.coerce.number().default(3000),
    OPENAI_API_KEY: z.string().min(1),
    OPENAI_LLM: z.string().min(1),
})

export const env = envSchema.parse(process.env);
