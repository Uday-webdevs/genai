import express from "express";
import cors from "cors";

import aiRoutes from "./routes/ai.routes";
import analysisRoutes from "./routes/analysis.routes"
import ragRoutes from "./routes/rag.routes";
import { env } from "./config/env";

const app = express();

app.use(cors({
    origin: env.CORS_ORIGIN
}))

app.use(express.json());

app.use('/api/ai', aiRoutes)
app.use('/api/ai', analysisRoutes)
app.use('/api/rag', ragRoutes)

app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'Health ok'})
})


export default app;
