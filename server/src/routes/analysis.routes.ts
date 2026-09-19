import { Router } from "express";

import { analyzeSupportRequest } from "../controller/analysis.controller";

const router = Router();

router.post("/analyze", analyzeSupportRequest)

export default router;
