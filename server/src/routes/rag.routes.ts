import { Router } from "express";

import {
    ragChat,
    ragStatus,
    uploadRagDocument,
} from "../controller/rag.controller";
import { acceptSinglePdf } from "../middleware/pdf-upload.middleware";

const router = Router();

router.get("/status", ragStatus);
router.post("/chat", ragChat);
router.post("/documents", acceptSinglePdf, uploadRagDocument);

export default router;
