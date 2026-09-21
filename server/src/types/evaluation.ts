import type { RagAnswer, RagTokenUsage, RetrievedChunk } from "./rag";

export type EvaluationCategory =
    | "direct"
    | "synthesis"
    | "unanswerable"
    | "adversarial";

export interface RagEvaluationCase {
    id: string;
    category: EvaluationCategory;
    question: string;
    answerable: boolean;
    expectedFacts: string[];
    relevantPages: number[];
    relevantDocumentTitles?: string[];
    notes?: string;
}

export interface RetrievedEvidence {
    rank: number;
    chunkId: string;
    title: string;
    pdfPageStart: number;
    pdfPageEnd: number;
    score: number;
    relevant: boolean;
}

export interface RetrievalEvaluation {
    hitAtK: boolean | null;
    reciprocalRank: number | null;
    precisionAtK: number | null;
    pageRecallAtK: number | null;
    evidence: RetrievedEvidence[];
}

export interface AnswerJudgeResult {
    correctnessScore: number;
    faithfulnessScore: number;
    citationScore: number;
    refusalCorrect: boolean;
    unsupportedClaims: string[];
    feedback: string;
}

export interface EvaluationTimings {
    retrievalMs: number;
    generationMs: number;
    judgeMs: number;
    totalMs: number;
}

export interface RagEvaluationCaseResult {
    testCase: RagEvaluationCase;
    retrieval?: RetrievalEvaluation;
    answer?: RagAnswer;
    judge?: AnswerJudgeResult;
    passed: boolean | null;
    timings: EvaluationTimings;
    generationUsage?: RagTokenUsage;
    judgeUsage?: RagTokenUsage;
    error?: string;
}

export interface RagEvaluationSummary {
    totalCases: number;
    evaluatedCases: number;
    errorCount: number;
    answerableCases: number;
    unanswerableCases: number;
    retrievalHitRate: number | null;
    meanReciprocalRank: number | null;
    meanPrecisionAtK: number | null;
    meanPageRecallAtK: number | null;
    meanCorrectness: number | null;
    meanFaithfulness: number | null;
    meanCitationQuality: number | null;
    refusalAccuracy: number | null;
    endToEndPassRate: number | null;
    averageLatencyMs: number;
    p95LatencyMs: number;
    generationTokens: number;
    judgeTokens: number;
}

export interface RagEvaluationReport {
    createdAt: string;
    datasetPath: string;
    retrievalOnly: boolean;
    configuration: {
        generationModel: string;
        evaluationModel: string;
        embeddingModel: string;
        topK: number;
        numCandidates: number;
    };
    summary: RagEvaluationSummary;
    cases: RagEvaluationCaseResult[];
}

/**
 * Checks whether a retrieved chunk's inclusive PDF page range contains a page.
 *
 * @param chunk - Retrieved chunk with citation page metadata.
 * @param page - One-based PDF page label from an evaluation case.
 * @returns `true` when the page falls inside the chunk's page range.
 */
export function retrievedChunkCoversPage(
    chunk: RetrievedChunk,
    page: number,
): boolean {
    return (
        chunk.metadata.pdfPageStart <= page &&
        chunk.metadata.pdfPageEnd >= page
    );
}
