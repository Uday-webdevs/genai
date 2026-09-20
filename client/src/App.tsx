import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import "./App.css";
import {
  askKnowledgeBase,
  getRagStatus,
} from "./services/chat.service";
import type {
  IChatMessage,
  IRagCitation,
  IRagStatus,
} from "./types/chat";

const SUGGESTED_QUESTIONS = [
  "Explain the laws of motion with an everyday example.",
  "What is refraction of light?",
  "Summarize the chapter on gravitation.",
];

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
  const endRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

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
    return () => requestControllerRef.current?.abort();
  }, []);

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

        <div className="sidebar-section">
          <p className="section-label">Knowledge base</p>
          <div className="resource-card">
            <span className="resource-icon"><SourceIcon /></span>
            <span className="resource-copy">
              <strong>Science & Technology</strong>
              <span>Standard Ten · Part 1</span>
            </span>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="status-row">
            <span className={`status-dot ${isReady ? "online" : statusUnavailable ? "offline" : status ? "empty" : "checking"}`} />
            <span>{statusLabel}</span>
          </div>
          {status && (
            <p>{status.readyDocuments} document · {status.chunks} searchable passages</p>
          )}
        </div>
      </aside>

      <main className="chat-panel">
        <header className="chat-header">
          <div>
            <span className="eyebrow">Textbook assistant</span>
            <h1>Ask your science book</h1>
          </div>
          <div className={`grounded-pill ${isReady ? "ready" : ""}`}>
            <span />
            {isReady ? "Grounded in your book" : status ? "No source" : "Connecting"}
          </div>
        </header>

        <section className={`conversation ${messages.length === 0 ? "empty" : ""}`} aria-live="polite">
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-icon"><SparkIcon /></div>
              <span className="welcome-kicker">Learn with evidence</span>
              <h2>Grounded answers.<br />Clearer understanding.</h2>
              <p>
                Ask anything from your indexed science textbook. Every answer is
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
              placeholder={isReady ? "Ask a question about your science textbook…" : "Waiting for the knowledge base…"}
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
