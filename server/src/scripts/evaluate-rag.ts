import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { closeDatabase } from "../config/database";
import { evaluateRag } from "../services/evaluation.service";
import type {
    RagEvaluationCaseResult,
    RagEvaluationReport,
} from "../types/evaluation";

interface CliOptions {
    datasetPath: string;
    retrievalOnly: boolean;
    limit?: number;
    caseId?: string;
}

/**
 * Reads a required value following a CLI flag.
 *
 * @param args - Raw command-line arguments.
 * @param index - Position of the flag in `args`.
 * @param flag - Flag name included in validation errors.
 * @returns The non-flag value following the requested flag.
 */
function requireValue(args: string[], index: number, flag: string): string {
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
        throw new Error(`${flag} requires a value.`);
    }
    return value;
}

/**
 * Parses dataset selection, filters, and evaluation mode from CLI arguments.
 *
 * @param args - Raw command-line arguments without the executable/script path.
 * @returns Validated options for the evaluation service.
 */
function parseOptions(args: string[]): CliOptions {
    const options: CliOptions = {
        datasetPath: resolve("evals/rag-cases.jsonl"),
        retrievalOnly: false,
    };

    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];

        if (argument === "--retrieval-only") {
            options.retrievalOnly = true;
            continue;
        }

        if (argument === "--dataset") {
            options.datasetPath = resolve(
                requireValue(args, index, "--dataset"),
            );
            index += 1;
            continue;
        }

        if (argument === "--limit") {
            const value = Number(requireValue(args, index, "--limit"));
            if (!Number.isInteger(value) || value < 1) {
                throw new Error("--limit must be a positive integer.");
            }
            options.limit = value;
            index += 1;
            continue;
        }

        if (argument === "--case") {
            options.caseId = requireValue(args, index, "--case");
            index += 1;
            continue;
        }

        throw new Error(`Unknown argument: ${argument}`);
    }

    return options;
}

function percentage(value: number | null): string {
    return value === null ? "n/a" : `${(value * 100).toFixed(1)}%`;
}

function score(value: number | undefined): string {
    return value === undefined ? "n/a" : `${value}/4`;
}

function escapeCell(value: string): string {
    return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function resultStatus(result: RagEvaluationCaseResult): string {
    if (result.error) return "ERROR";
    if (result.passed === null) return "RETRIEVAL ONLY";
    return result.passed ? "PASS" : "FAIL";
}

/**
 * Renders a human-readable Markdown report from the machine-readable result.
 *
 * @param report - Complete evaluation report to render.
 * @returns Markdown containing summary metrics, cases, and failure details.
 */
function toMarkdown(report: RagEvaluationReport): string {
    const { summary } = report;
    const lines = [
        "# RAG evaluation report",
        "",
        `Generated: ${report.createdAt}`,
        `Dataset: ${report.datasetPath}`,
        `Mode: ${report.retrievalOnly ? "retrieval only" : "full"}`,
        `Models: generation=${report.configuration.generationModel}, judge=${report.configuration.evaluationModel}, embedding=${report.configuration.embeddingModel}`,
        `Retrieval: topK=${report.configuration.topK}, numCandidates=${report.configuration.numCandidates}`,
        "",
        "## Summary",
        "",
        `- Cases: ${summary.evaluatedCases}/${summary.totalCases} evaluated (${summary.errorCount} errors)`,
        `- Retrieval Hit Rate@K: ${percentage(summary.retrievalHitRate)}`,
        `- Mean Reciprocal Rank: ${summary.meanReciprocalRank?.toFixed(3) ?? "n/a"}`,
        `- Mean Precision@K: ${percentage(summary.meanPrecisionAtK)}`,
        `- Mean page recall@K: ${percentage(summary.meanPageRecallAtK)}`,
        `- Mean answer correctness: ${percentage(summary.meanCorrectness)}`,
        `- Mean faithfulness: ${percentage(summary.meanFaithfulness)}`,
        `- Mean citation quality: ${percentage(summary.meanCitationQuality)}`,
        `- Refusal accuracy: ${percentage(summary.refusalAccuracy)}`,
        `- End-to-end pass rate: ${percentage(summary.endToEndPassRate)}`,
        `- Average / p95 latency: ${summary.averageLatencyMs.toFixed(0)} ms / ${summary.p95LatencyMs.toFixed(0)} ms`,
        `- Measured generation / judge tokens: ${summary.generationTokens} / ${summary.judgeTokens}`,
        "",
        "## Cases",
        "",
        "| Case | Category | Status | Hit@K | MRR | Correct | Faithful | Citations | Latency |",
        "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ];

    for (const result of report.cases) {
        lines.push(
            `| ${escapeCell(result.testCase.id)} | ${result.testCase.category} | ${resultStatus(result)} | ${result.retrieval?.hitAtK === null || result.retrieval?.hitAtK === undefined ? "n/a" : result.retrieval.hitAtK ? "yes" : "no"} | ${result.retrieval?.reciprocalRank?.toFixed(3) ?? "n/a"} | ${score(result.judge?.correctnessScore)} | ${score(result.judge?.faithfulnessScore)} | ${score(result.judge?.citationScore)} | ${result.timings.totalMs} ms |`,
        );
    }

    const failures = report.cases.filter(
        (result) => result.error || result.passed === false,
    );
    if (failures.length > 0) {
        lines.push("", "## Failures to inspect", "");
        for (const result of failures) {
            lines.push(
                `### ${result.testCase.id}`,
                "",
                `Question: ${result.testCase.question}`,
                "",
                result.error
                    ? `Error: ${result.error}`
                    : `Judge feedback: ${result.judge?.feedback ?? "No feedback"}`,
                "",
                `Answer: ${result.answer?.answer ?? "No answer"}`,
                "",
            );
        }
    }

    lines.push(
        "## Interpretation",
        "",
        "These numbers describe this labeled dataset, index snapshot, and model configuration. They are not a universal accuracy guarantee. Review failures manually and keep a separate holdout set before tuning.",
        "",
    );

    return lines.join("\n");
}

/** Executes the evaluation CLI and writes timestamped JSON and Markdown output. */
async function main(): Promise<void> {
    const options = parseOptions(process.argv.slice(2));
    const report = await evaluateRag({
        ...options,
        onCaseStart: (testCase, index, total) => {
            console.log(`[${index + 1}/${total}] ${testCase.id}`);
        },
    });

    const timestamp = report.createdAt.replaceAll(":", "-");
    const outputDirectory = join(dirname(options.datasetPath), "results");
    const jsonPath = join(outputDirectory, `${timestamp}.json`);
    const markdownPath = join(outputDirectory, `${timestamp}.md`);

    await mkdir(outputDirectory, { recursive: true });
    await Promise.all([
        writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
        writeFile(markdownPath, toMarkdown(report), "utf8"),
    ]);

    console.log("\nRAG evaluation complete");
    console.log(`Hit Rate@K: ${percentage(report.summary.retrievalHitRate)}`);
    console.log(`MRR: ${report.summary.meanReciprocalRank?.toFixed(3) ?? "n/a"}`);
    console.log(`Correctness: ${percentage(report.summary.meanCorrectness)}`);
    console.log(`Faithfulness: ${percentage(report.summary.meanFaithfulness)}`);
    console.log(`Citation quality: ${percentage(report.summary.meanCitationQuality)}`);
    console.log(`Refusal accuracy: ${percentage(report.summary.refusalAccuracy)}`);
    console.log(`End-to-end pass rate: ${percentage(report.summary.endToEndPassRate)}`);
    console.log(`JSON report: ${jsonPath}`);
    console.log(`Markdown report: ${markdownPath}`);

    if (report.summary.errorCount > 0) {
        process.exitCode = 1;
    }
}

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDatabase();
    });
