import { Router } from "express";

import {
    ragChat,
    ragStatus,
} from "../controller/rag.controller";

const router = Router();

router.get("/status", ragStatus);
router.post("/chat", ragChat);

export default router;
