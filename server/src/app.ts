import express from "express";
import cors from "cors";

import aiRoutes from "./routes/ai.routes";
import analysisRoutes from "./routes/analysis.routes"

const app = express();

app.use(cors({
    origin: "http://localhost:5173"
}))

app.use(express.json());

app.use('/api/ai', aiRoutes)
app.use('/api/ai', analysisRoutes)

app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'Health ok'})
})


export default app;
