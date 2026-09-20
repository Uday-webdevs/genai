import type {
  IChatTurn,
  IRagAnswer,
  IRagStatus,
} from "../types/chat";

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? "Something went wrong. Please try again.";
  } catch {
    return "Something went wrong. Please try again.";
  }
}

export async function getRagStatus(
  signal?: AbortSignal,
): Promise<IRagStatus> {
  const response = await fetch(`${API_URL}/api/rag/status`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.json() as Promise<IRagStatus>;
}

export async function askKnowledgeBase(
  message: string,
  history: IChatTurn[],
  signal?: AbortSignal,
): Promise<IRagAnswer> {
  const response = await fetch(`${API_URL}/api/rag/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, history }),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.json() as Promise<IRagAnswer>;
}
