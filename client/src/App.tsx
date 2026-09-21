import {
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import "./App.css";
import {
  askKnowledgeBase,
  getRagStatus,
  uploadKnowledgeDocument,
} from "./services/chat.service";
import type {
  IChatMessage,
  IRagDocumentSummary,
  IRagCitation,
  IRagStatus,
} from "./types/chat";

const SUGGESTED_QUESTIONS = [
  "Summarize the main ideas in my documents.",
  "What are the most important concepts to understand?",
  "Create five study questions from the uploaded material.",
];

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

interface UploadState {
  fileName: string;
  phase: "uploading" | "indexing";
  progress: number;
}

interface UploadFeedback {
  type: "success" | "error";
  message: string;
}

type IconProps = { className?: string };

function BookIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />
      <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5v-16Z" />
    </svg>
  );
}

function SparkIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2.8c.45 4.8 2.55 7.05 7.2 7.7-4.65.65-6.75 2.9-7.2 7.7-.45-4.8-2.55-7.05-7.2-7.7 4.65-.65 6.75-2.9 7.2-7.7Z" />
      <path d="M19 16.2c.2 2.1 1.15 3.05 3.2 3.3-2.05.25-3 1.2-3.2 3.3-.2-2.1-1.15-3.05-3.2-3.3 2.05-.25 3-1.2 3.2-3.3Z" />
    </svg>
  );
}

function PlusIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SendIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m5 12 14-7-4.5 14-2.8-5.7L5 12Z" />
      <path d="m11.7 13.3 3.4-3.4" />
    </svg>
  );
}

function SourceIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 3h8l4 4v14H6V3Z" />
      <path d="M14 3v5h4M9 12h6M9 16h6" />
    </svg>
  );
}

function UploadIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 16V4M7.5 8.5 12 4l4.5 4.5" />
      <path d="M5 14v5h14v-5" />
    </svg>
  );
}

function DocumentCard({ document }: { document: IRagDocumentSummary }) {
  const detail =
    document.status === "ready"
      ? `${document.pageCount} pages · ${document.chunkCount} passages`
      : document.status === "processing"
        ? "Indexing now"
        : "Indexing failed";

  return (
    <div className={`resource-card ${document.status}`} title={document.error}>
      <span className="resource-icon"><SourceIcon /></span>
      <span className="resource-copy">
        <strong>{document.title}</strong>
        <span>{detail}</span>
      </span>
      <span className="document-status" aria-label={document.status} />
    </div>
  );
}

function CitationCard({ citation, index }: { citation: IRagCitation; index: number }) {
  const pageLabel =
    citation.pdfPageStart === citation.pdfPageEnd
      ? `PDF page ${citation.pdfPageStart}`
      : `PDF pages ${citation.pdfPageStart}–${citation.pdfPageEnd}`;

  return (
    <details className="citation-card">
      <summary>
        <span className="citation-number">{index + 1}</span>
        <span className="citation-summary">
          <strong>{citation.title}</strong>
          <span>{pageLabel}</span>
        </span>
        <span className="citation-score">
          {Math.round(citation.retrievalScore * 100)}% match
        </span>
      </summary>
      <p>{citation.excerpt}</p>
    </details>
  );
}

function App() {
  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<IRagStatus | null>(null);
  const [statusUnavailable, setStatusUnavailable] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState | null>(null);
  const [uploadFeedback, setUploadFeedback] = useState<UploadFeedback | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const uploadControllerRef = useRef<AbortController | null>(null);

  const refreshStatus = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await getRagStatus(signal);
      setStatus(result);
      setStatusUnavailable(false);
    } catch (requestError: unknown) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setStatusUnavailable(true);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    getRagStatus(controller.signal)
      .then((result) => {
        setStatus(result);
        setStatusUnavailable(false);
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setStatusUnavailable(true);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    return () => {
      requestControllerRef.current?.abort();
      uploadControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!uploadState || uploadState.phase !== "indexing") return;

    const interval = window.setInterval(() => {
      void refreshStatus();
    }, 3_000);

    return () => window.clearInterval(interval);
  }, [refreshStatus, uploadState]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const field = textAreaRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 150)}px`;
  }, [input]);

  async function sendMessage(rawMessage: string): Promise<void> {
    const message = rawMessage.trim();
    if (!message || loading) return;

    const userMessage: IChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError(null);
    setLoading(true);
    const controller = new AbortController();
    requestControllerRef.current = controller;

    try {
      const history = messages.slice(-6).map((item) => ({
        role: item.role,
        content: item.content.slice(0, 4_000),
      }));
      const result = await askKnowledgeBase(
        message,
        history,
        controller.signal,
      );

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.answer,
          grounded: result.grounded,
          citations: result.citations,
        },
      ]);
    } catch (requestError: unknown) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The assistant couldn't answer right now.",
      );
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
        setLoading(false);
        requestAnimationFrame(() => textAreaRef.current?.focus());
      }
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void sendMessage(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  }

  function startNewChat(): void {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setMessages([]);
    setInput("");
    setError(null);
    setLoading(false);
    requestAnimationFrame(() => textAreaRef.current?.focus());
  }

  async function handlePdf(file: File): Promise<void> {
    if (uploadState) return;

    if (
      file.type !== "application/pdf" ||
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setUploadFeedback({
        type: "error",
        message: "Choose a PDF file to continue.",
      });
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadFeedback({
        type: "error",
        message: "PDFs must be 25 MB or smaller.",
      });
      return;
    }

    const controller = new AbortController();
    uploadControllerRef.current = controller;
    setUploadFeedback(null);
    setUploadState({
      fileName: file.name,
      phase: "uploading",
      progress: 0,
    });

    try {
      const result = await uploadKnowledgeDocument(
        file,
        (progress) => {
          setUploadState({
            fileName: file.name,
            phase: progress >= 100 ? "indexing" : "uploading",
            progress,
          });
        },
        controller.signal,
      );

      await refreshStatus();
      setUploadFeedback({
        type: "success",
        message:
          result.status === "skipped"
            ? "This PDF was already in your knowledge base."
            : `${result.title} is ready with ${result.chunkCount} passages.`,
      });
    } catch (uploadError: unknown) {
      if (uploadError instanceof DOMException && uploadError.name === "AbortError") return;
      setUploadFeedback({
        type: "error",
        message:
          uploadError instanceof Error
            ? uploadError.message
            : "The PDF could not be indexed.",
      });
    } finally {
      if (uploadControllerRef.current === controller) {
        uploadControllerRef.current = null;
        setUploadState(null);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setDragActive(false);
    const [file] = Array.from(event.dataTransfer.files);
    if (file) void handlePdf(file);
  }

  const isReady = Boolean(status && status.readyDocuments > 0);
  const statusLabel = isReady
    ? "Knowledge base ready"
    : statusUnavailable
      ? "Service unavailable"
      : status
        ? "No indexed documents"
        : "Checking knowledge base";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><BookIcon /></span>
          <span>
            <strong>Studyground</strong>
            <small>Knowledge companion</small>
          </span>
        </div>

        <button className="new-chat-button" type="button" onClick={startNewChat}>
          <PlusIcon />
          New conversation
        </button>

        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handlePdf(file);
          }}
        />

        <div
          className={`upload-card ${dragActive ? "drag-active" : ""} ${uploadState ? "busy" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <span className="upload-icon"><UploadIcon /></span>
          {uploadState ? (
            <>
              <strong>
                {uploadState.phase === "uploading" ? "Uploading PDF" : "Building knowledge"}
              </strong>
              <span className="upload-file-name">{uploadState.fileName}</span>
              <span className="progress-track">
                <span style={{ width: `${uploadState.progress}%` }} />
              </span>
              <small>
                {uploadState.phase === "uploading"
                  ? `${uploadState.progress}% uploaded`
                  : "Extracting, chunking and embedding..."}
              </small>
            </>
          ) : (
            <>
              <strong>Add a PDF</strong>
              <span>Drop it here or browse</span>
              <button type="button" onClick={() => fileInputRef.current?.click()}>
                Choose file
              </button>
              <small>Text-based PDF · Up to 25 MB</small>
            </>
          )}
        </div>

        {uploadFeedback && (
          <div className={`upload-feedback ${uploadFeedback.type}`} role="status">
            <span>{uploadFeedback.message}</span>
            <button
              type="button"
              onClick={() => setUploadFeedback(null)}
              aria-label="Dismiss upload message"
            >×</button>
          </div>
        )}

        <div className="sidebar-section">
          <p className="section-label">
            Knowledge base
            {status && <span>{status.documents.length}</span>}
          </p>
          <div className="resource-list">
            {status?.documents.map((document) => (
              <DocumentCard document={document} key={document.id} />
            ))}
            {status && status.documents.length === 0 && (
              <p className="empty-resources">Upload your first PDF to start asking questions.</p>
            )}
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="status-row">
            <span className={`status-dot ${isReady ? "online" : statusUnavailable ? "offline" : status ? "empty" : "checking"}`} />
            <span>{statusLabel}</span>
          </div>
          {status && (
            <p>{status.readyDocuments} ready · {status.chunks} searchable passages</p>
          )}
        </div>
      </aside>

      <main className="chat-panel">
        <header className="chat-header">
          <div>
            <span className="eyebrow">Source-grounded assistant</span>
            <h1>Chat with your PDFs</h1>
          </div>
          <div className="header-actions">
            <button
              className="mobile-upload-button"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={Boolean(uploadState)}
            >
              <UploadIcon />
              {uploadState ? "Indexing" : "Add PDF"}
            </button>
            <div className={`grounded-pill ${isReady ? "ready" : ""}`}>
              <span />
              {isReady ? "Grounded in your PDFs" : status ? "No source" : "Connecting"}
            </div>
          </div>
        </header>

        <section className={`conversation ${messages.length === 0 ? "empty" : ""}`} aria-live="polite">
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-icon"><SparkIcon /></div>
              <span className="welcome-kicker">Learn with evidence</span>
              <h2>Grounded answers.<br />Clearer understanding.</h2>
              <p>
                Ask anything from your indexed PDFs. Every answer is
                checked against the source and comes with page-level references.
              </p>

              <div className="suggestions">
                {SUGGESTED_QUESTIONS.map((question, index) => (
                  <button
                    type="button"
                    key={question}
                    onClick={() => void sendMessage(question)}
                    disabled={loading || !isReady}
                  >
                    <span>0{index + 1}</span>
                    {question}
                    <span className="suggestion-arrow">↗</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list">
              {messages.map((message) => (
                <article className={`message ${message.role}`} key={message.id}>
                  <div className="avatar" aria-hidden="true">
                    {message.role === "assistant" ? <SparkIcon /> : "You"}
                  </div>
                  <div className="message-body">
                    <div className="message-meta">
                      <strong>{message.role === "assistant" ? "Studyground" : "You"}</strong>
                      {message.role === "assistant" && message.grounded && (
                        <span className="verified-label">Source verified</span>
                      )}
                    </div>
                    <div className="message-content">{message.content}</div>
                    {message.citations && message.citations.length > 0 && (
                      <div className="citations">
                        <p className="citations-heading">
                          <SourceIcon /> Sources used
                        </p>
                        {message.citations.map((citation, index) => (
                          <CitationCard
                            citation={citation}
                            index={index}
                            key={citation.chunkId}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))}

              {loading && (
                <article className="message assistant loading-message">
                  <div className="avatar"><SparkIcon /></div>
                  <div className="message-body">
                    <div className="message-meta"><strong>Studyground</strong></div>
                    <div className="thinking">
                      <span /><span /><span />
                      Searching the textbook
                    </div>
                  </div>
                </article>
              )}
              <div ref={endRef} />
            </div>
          )}
        </section>

        <div className="composer-wrap">
          {uploadFeedback && (
            <div className={`mobile-upload-feedback ${uploadFeedback.type}`} role="status">
              <span>{uploadFeedback.message}</span>
              <button
                type="button"
                onClick={() => setUploadFeedback(null)}
                aria-label="Dismiss upload message"
              >×</button>
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} aria-label="Dismiss error">×</button>
            </div>
          )}
          <form className="composer" onSubmit={handleSubmit}>
            <textarea
              ref={textAreaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isReady ? "Ask a question across your PDFs…" : "Upload a PDF to begin…"}
              rows={1}
              maxLength={2_000}
              disabled={loading || !isReady}
              aria-label="Your question"
            />
            <button
              className="send-button"
              type="submit"
              disabled={loading || !input.trim() || !isReady}
              aria-label="Send question"
            >
              <SendIcon />
            </button>
          </form>
          <p className="composer-hint">
            Answers are generated from retrieved passages. Always verify critical information.
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;
