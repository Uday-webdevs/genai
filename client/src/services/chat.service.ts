import type {
  IChatTurn,
  IRagAnswer,
  IRagStatus,
  IUploadResult,
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

export function uploadKnowledgeDocument(
  file: File,
  onProgress: (percentage: number) => void,
  signal?: AbortSignal,
): Promise<IUploadResult> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    const abortRequest = () => request.abort();
    const removeAbortListener = () => {
      signal?.removeEventListener("abort", abortRequest);
    };

    request.open("POST", `${API_URL}/api/rag/documents`);
    request.responseType = "json";

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    });

    request.addEventListener("load", () => {
      removeAbortListener();
      const body = request.response as
        | IUploadResult
        | { error?: string }
        | null;

      if (request.status >= 200 && request.status < 300 && body) {
        resolve(body as IUploadResult);
        return;
      }

      reject(
        new Error(
          body && "error" in body && body.error
            ? body.error
            : "The PDF could not be uploaded.",
        ),
      );
    });

    request.addEventListener("error", () => {
      removeAbortListener();
      reject(new Error("Could not connect to the upload service."));
    });

    request.addEventListener("abort", () => {
      removeAbortListener();
      reject(new DOMException("Upload cancelled", "AbortError"));
    });

    signal?.addEventListener("abort", abortRequest, { once: true });
    request.send(formData);
  });
}
