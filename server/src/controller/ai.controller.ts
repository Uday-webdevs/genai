import { Request, Response } from "express";
import { z } from "zod";

import { generateAnswer, generateAnswerStream } from "../services/llm.service";

const chatSchema = z.object({
    message: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(10_000, "Message too long")
})

export async function chat(
    req: Request,
    res: Response,
) {
    const result = chatSchema.safeParse(req.body);
    
    if (!result.success) {
        return res.status(400).json({
            error: "Invalid request",
            details: result.error.flatten()
        })
    }
    
    try {
        const answer = await generateAnswer(result.data.message)

        return res.status(200).json({
            answer
        });
    } catch (e) {
        console.error("LLM request failed:", e)

        return res.status(502).json({
            error: "AI service temporarily unavailable."
        })
    }
}

export async function chatStream(
    req: Request,
    res: Response,
) {
    const result = chatSchema.safeParse(req.body)

    if (!result.success) {
        return res.status(400).json({
            error: "Invalid input",
            details: result.error.flatten()
        })
    }

    const controller = new AbortController()

    let completed = false;
    let timedOut = false;
    let clientDisconnected = false;

    const timedOutMessage = "AI response timed out. Please try again."

    let timeout = setTimeout(() => {
        /** To handle race condition, if the response is completed / cliet disconnected at the exactly at the TIMEOUT time. */
        if (completed || clientDisconnected || res.writableEnded) {
            return;
        }

        timedOut = true;
        controller.abort();

        console.log("timeout hit: true and aborted")

        res.write(
            `data: ${JSON.stringify({
                error: timedOutMessage,
                code: "LLM_TIMEOUT"
            })}\n\n`
        );

        res.end();
    }, 30_000)

    try {
        res.on("close", () => {
            if (completed || timedOut) return;

            console.log("Client disconnected.")

            clientDisconnected = true;
            controller.abort();
        })

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        res.flushHeaders();

        const stream = await generateAnswerStream(result.data.message, controller.signal)

        for await (const event of stream) {
            if (event.type === "response.output_text.delta") {
                res.write(`data: ${event.delta}\n\n`)
            }
        }


        if (!timedOut && !clientDisconnected && !res.writableEnded){
            completed = true;

            res.write("data: [DONE]\n\n")
            res.end();

            console.log("LLM stream completed successfully.")
        }
    } catch (e) {
        console.error("LLM streaming failed:", e);

        if (!res.headersSent) {
            return res.status(502).json({
                error: "AI service temporarily unavailable."
            })
        }
        
        res.write(
            `data: ${JSON.stringify({
                error: "AI service temporarily unavailable"
            })}\n\n`
        )

        res.end();
    } finally {
        clearTimeout(timeout)
    }
}