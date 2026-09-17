import express from "express";
import aiRoutes from "./routes/ai.routes";

const app = express();

app.use(express.json());

app.use('/api/ai', aiRoutes)

app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'Health ok'})
})


export default app;
