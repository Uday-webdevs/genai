# RAG evaluation set

`rag-cases.jsonl` is a small, human-labeled seed set for the currently indexed Grade 10 science textbook. Each line is one JSON test case.

Run a cheap retrieval-only evaluation first:

```bash
npm run eval:rag -- --retrieval-only
```

Run the full retrieval, generation, and model-judge evaluation:

```bash
npm run eval:rag
```

Useful filters:

```bash
npm run eval:rag -- --case gravity-universal-law
npm run eval:rag -- --limit 5
npm run eval:rag -- --dataset evals/my-holdout-cases.jsonl
```

JSON and Markdown reports are written to `evals/results/`, which is intentionally ignored by Git.

## What the metrics mean

- Hit Rate@K: percentage of answerable questions for which at least one labeled page was retrieved.
- MRR: how early the first relevant chunk appeared. Higher is better.
- Precision@K: percentage of retrieved chunks that overlap a labeled relevant page.
- Page recall@K: percentage of labeled pages covered by retrieved chunks.
- Correctness: how completely the response covers the human-written expected facts.
- Faithfulness: whether claims are supported by retrieved evidence.
- Citation quality: whether selected citations directly support the response.
- Refusal accuracy: whether unanswerable/adversarial questions are declined rather than answered from model memory.
- End-to-end pass rate: retrieval hit plus judge scores of at least 3/4 for answerable cases, or a faithful refusal for unanswerable cases.

The judge is useful for iteration but is not ground truth. Manually inspect failures, periodically audit passing samples, and have a domain expert verify important cases.

## Growing this into a production evaluation

1. Verify every seed case and relevant page against the source PDF.
2. Add real, anonymized user questions and hard paraphrases.
3. Include questions needing multiple chunks, tables, noisy pages, and conflicting documents.
4. Keep a development set for tuning and a separate holdout set that is not used while tuning.
5. Pin model/index/chunker versions in reports and compare results before deployment.
6. Add CI regression gates only after the holdout set is large and stable enough.

The current seed set is intentionally small. Its score is a baseline for this exact dataset and configuration—not a claim of universal RAG accuracy.
