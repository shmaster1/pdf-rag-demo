"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Send,
  Loader2,
  Bot,
  User,
  Upload,
  AlertCircle,
} from "lucide-react";

const API_BASE = "https://pdf-rag-demo.onrender.com";
const EVALUATION_ENDPOINT = `${API_BASE}/evaluation/`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface UploadState {
  status: "idle" | "uploading" | "success" | "error";
  step?: "converting" | "embedding" | "indexing";
  attempt?: number;
  fileName?: string;
  error?: string;
}

const STEP_LABELS: Record<string, string> = {
  converting: "Converting PDF to text…",
  embedding: "Generating embeddings…",
  indexing: "Indexing into vector database…",
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastContexts, setLastContexts] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [evalScores, setEvalScores] = useState<Record<string, number> | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const clearBackend = useCallback(() => {
    fetch(`${API_BASE}/pdf_converter/`, { method: "DELETE" });
  }, []);

  useEffect(() => {
    clearBackend();
  }, [clearBackend]);

  const MAX_FILE_SIZE_MB = 10;

  const uploadPDF = useCallback(async (file: File) => {
    if (!file.name.endsWith(".pdf")) {
      setUploadState({ status: "error", error: "Only PDF files are accepted." });
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setUploadState({ status: "error", error: `File exceeds the ${MAX_FILE_SIZE_MB}MB size limit.` });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      setUploadState({ status: "uploading", step: "converting", attempt, fileName: file.name });

      try {
        const res = await fetch(`${API_BASE}/pdf_converter/`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error(`Server error: ${res.status}`);

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let completed = false;

        outer: while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          for (const line of text.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const event = JSON.parse(line.slice(6)) as { stage: string; message?: string };
            if (event.stage === "error") {
              setUploadState({ status: "error", fileName: file.name, error: event.message ?? "Processing failed" });
              return;
            }
            if (event.stage === "done") {
              setUploadState({ status: "success", fileName: file.name });
              setMessages([]);
              setShowToast(true);
              completed = true;
              break outer;
            }
            setUploadState({ status: "uploading", step: event.stage as UploadState["step"], attempt, fileName: file.name });
          }
        }

        if (completed) return;
        // Stream ended without a done event — connection dropped, retry
      } catch {
        if (attempt === MAX_RETRIES) {
          setUploadState({ status: "error", fileName: file.name, error: "Connection lost. Please try again." });
          return;
        }
      }

      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 30000));
      }
    }

    setUploadState({ status: "error", fileName: file.name, error: "Connection lost after 3 attempts." });
  }, []);

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadPDF(file);
    },
    [uploadPDF]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadPDF(file);
    e.target.value = "";
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isQuerying) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setIsQuerying(true);

    try {
      const res = await fetch(`${API_BASE}/rag/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setLastContexts(data.contexts ?? []);
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`,
        },
      ]);
    } finally {
      setIsQuerying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  };

  const clearDocument = () => {
    clearBackend();
    setUploadState({ status: "idle" });
    setMessages([]);
  };

  const lastQA = useMemo(() => {
    for (let i = messages.length - 1; i >= 1; i--) {
      if (messages[i].role === "assistant" && messages[i - 1].role === "user") {
        return { question: messages[i - 1].content, answer: messages[i].content };
      }
    }
    return null;
  }, [messages]);

  const openEvalModal = () => {
    setEvalScores(null);
    setEvalError(null);
    setShowEvalModal(true);
    runEvaluation();
  };

  const runEvaluation = async () => {
    if (!lastQA || !lastContexts.length) return;

    setIsEvaluating(true);
    setEvalError(null);
    setEvalScores(null);

    try {
      const res = await fetch(EVALUATION_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: lastQA.question,
          answer: lastQA.answer,
          contexts: lastContexts,
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      setEvalScores(await res.json());
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="flex h-full" style={{ background: "var(--background)" }}>
      {/* Toast */}
      {showConfirm && (
        <div
          className="fixed top-4 left-1/2 z-50 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 rounded-2xl shadow-xl text-sm w-[calc(100%-2rem)] sm:w-auto"
          style={{
            transform: "translateX(-50%)",
            background: "#fff",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          }}
        >
          <div>
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Remove this document?</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>All chat history will be permanently gone.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
            <button
              onClick={() => setShowConfirm(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--border)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
            >
              Cancel
            </button>
            <button
              onClick={() => { setShowConfirm(false); clearDocument(); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: "#ef4444", color: "#fff" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#dc2626")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#ef4444")}
            >
              Yes, remove
            </button>
          </div>
        </div>
      )}

      {showToast && (
        <div
          className="fixed top-4 left-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium"
          style={{
            background: "#16a34a",
            color: "#ffffff",
            animation: "toast-pop 4.5s ease forwards",
          }}
          onAnimationEnd={() => setShowToast(false)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="white" strokeWidth="1.4" />
            <path d="M5 8l2.5 2.5L11 5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {uploadState.fileName} uploaded successfully
        </div>
      )}
      {/* Main chat area */}
      <main className="flex flex-1 flex-col min-w-0">
        {/* Chat header */}
        <header
          className="flex items-center justify-between px-3 sm:px-6 py-4 sm:py-5 border-b flex-shrink-0"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          {/* Spacer (balances the right side) */}
          <div className="w-8 sm:w-48 flex-shrink-0" />

          {/* Centered logo */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--accent)" }}
              >
                <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
                  <path d="M4 3h8l4 4v10a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" fill="white" fillOpacity="0.25" />
                  <path d="M12 3v4h4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M7 10h6M7 13h4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
                sha<span style={{ color: "var(--accent)" }}>pdf</span>
              </h1>
            </div>
            <p className="hidden sm:block text-xs tracking-wide" style={{ color: "var(--text-secondary)" }}>
              Chat with your documents, instantly
            </p>
          </div>

          {/* PDF thumbnail — right side */}
          <div className="w-8 sm:w-48 flex-shrink-0 flex justify-end">
            {uploadState.status === "success" && (
              <div
                className="flex items-center gap-2 px-2 sm:px-3 py-2 rounded-xl"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
              >
                <div
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(99,102,241,0.12)" }}
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                    <path d="M4 3h8l4 4v10a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
                    <path d="M12 3v4h4" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M7 10h6M7 13h4" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <span
                  className="hidden sm:block text-xs font-medium truncate max-w-24"
                  style={{ color: "var(--text-primary)" }}
                >
                  {uploadState.fileName}
                </span>
                <button
                  onClick={() => setShowConfirm(true)}
                  className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
                  title="Remove document"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 flex flex-col gap-4">
          {messages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              {uploadState.status !== "success" ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-4 rounded-2xl p-8 sm:p-12 cursor-pointer transition-all max-w-sm w-full"
                  style={{
                    border: `2px dashed ${isDragging ? "var(--accent)" : "var(--border)"}`,
                    background: isDragging ? "rgba(99,102,241,0.06)" : "transparent",
                  }}
                >
                  {uploadState.status === "uploading" ? (
                    <>
                      <Loader2 size={32} className="animate-spin" style={{ color: "var(--accent)" }} />
                      <div className="text-center">
                        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                          {STEP_LABELS[uploadState.step ?? "converting"]}
                        </p>
                        {uploadState.attempt && uploadState.attempt > 1 && (
                          <p className="text-xs mt-1" style={{ color: "var(--accent)" }}>
                            Retrying… (attempt {uploadState.attempt} of 3)
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center"
                        style={{ background: "rgba(99,102,241,0.12)" }}
                      >
                        <Upload size={28} style={{ color: "var(--accent)" }} />
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>
                          Drop your PDF here
                        </p>
                        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                          or click to browse
                        </p>
                      </div>
                    </>
                  )}
                  {uploadState.status === "error" && (
                    <div
                      className="rounded-lg px-4 py-2 flex items-center gap-2 text-xs"
                      style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
                    >
                      <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
                      <span className="text-red-400">{uploadState.error}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Type your first question below</span>
                  <svg
                    width="36" height="48" viewBox="0 0 20 28" fill="none"
                    style={{ animation: "bounce 1.4s ease-in-out infinite" }}
                  >
                    <path d="M10 2v20M3 16l7 8 7-8" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className="flex gap-2 sm:gap-3 w-full sm:max-w-3xl"
              >
                {/* Avatar */}
                <div
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{
                    background: msg.role === "user" ? "rgba(99,102,241,0.25)" : "var(--surface-2)",
                  }}
                >
                  {msg.role === "user" ? (
                    <User size={14} style={{ color: "var(--accent)" }} />
                  ) : (
                    <Bot size={14} style={{ color: "var(--text-secondary)" }} />
                  )}
                </div>

                {/* Bubble */}
                <div
                  className="rounded-2xl px-3 sm:px-4 py-3 text-sm leading-relaxed flex-1 sm:max-w-lg"
                  style={{
                    background: msg.role === "user" ? "var(--user-bubble)" : "var(--assistant-bubble)",
                    color: "var(--text-primary)",
                    border: `1px solid ${msg.role === "user" ? "rgba(99,102,241,0.3)" : "var(--border)"}`,
                    borderBottomLeftRadius: "4px",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))
          )}

          {isQuerying && (
            <div className="flex gap-2 sm:gap-3 w-full sm:max-w-3xl">
              <div
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: "var(--surface-2)" }}
              >
                <Bot size={14} style={{ color: "var(--text-secondary)" }} />
              </div>
              <div
                className="rounded-2xl px-4 py-3 flex items-center gap-2"
                style={{
                  background: "var(--assistant-bubble)",
                  border: "1px solid var(--border)",
                  borderBottomLeftRadius: "4px",
                }}
              >
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--text-secondary)", animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--text-secondary)", animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--text-secondary)", animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div
          className="px-3 sm:px-6 py-4 border-t flex-shrink-0"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div
            className="flex items-end gap-3 rounded-xl px-4 py-3"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={autoResize}
              onKeyDown={handleKeyDown}
              disabled={uploadState.status !== "success"}
              placeholder={
                uploadState.status === "success"
                  ? "Ask something about the document…"
                  : "Upload a PDF to enable chat"
              }
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-sm disabled:cursor-not-allowed"
              style={{
                color: "var(--text-primary)",
                maxHeight: "140px",
                lineHeight: "1.5",
                opacity: uploadState.status !== "success" ? 0.4 : 1,
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isQuerying || uploadState.status !== "success"}
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
              style={{
                background: input.trim() && !isQuerying && uploadState.status === "success" ? "var(--accent)" : "var(--border)",
                color: input.trim() && !isQuerying && uploadState.status === "success" ? "white" : "var(--text-secondary)",
                cursor: input.trim() && !isQuerying && uploadState.status === "success" ? "pointer" : "not-allowed",
              }}
            >
              {isQuerying ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Enter to send · Shift+Enter for new line
            </p>
            {/* TODO: Evaluate button hidden — ragas exceeds Render free tier 512MB RAM limit.
                Uncomment once upgraded to a paid plan (1GB+). All evaluation logic is intact. */}
            {/* {lastQA && lastContexts.length > 0 && (
              <button
                onClick={openEvalModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: "var(--accent)", color: "#fff" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M2 12h2v-4H2v4zm4 0h2V4H6v8zm4 0h2V7h-2v5z" fill="currentColor"/>
                </svg>
                Evaluate
              </button>
            )} */}
          </div>
        </div>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileInput}
      />

      {/* Evaluation Dashboard */}
      {showEvalModal && lastQA && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowEvalModal(false); }}
        >
          <div
            className="w-full max-w-md rounded-2xl flex flex-col gap-6 p-6"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>RAG Quality Dashboard</h2>
                <p className="text-xs mt-0.5 truncate max-w-xs" style={{ color: "var(--text-secondary)" }}>"{lastQA.question}"</p>
              </div>
              <button
                onClick={() => setShowEvalModal(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ color: "var(--text-secondary)", background: "var(--surface-2)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--border)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Metric cards */}
            {isEvaluating ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent)" }} />
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Evaluating response…</p>
              </div>
            ) : evalError ? (
              <div className="rounded-xl px-4 py-3 flex items-center gap-2 text-sm" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <AlertCircle size={15} className="text-red-400 flex-shrink-0" />
                <span className="text-red-400">{evalError}</span>
              </div>
            ) : evalScores ? (
              <div className="grid grid-cols-2 gap-3">
                {([
                  ["answer_relevancy", "Relevancy", "How well the answer addresses the question"],
                  ["faithfulness", "Faithfulness", "How grounded the answer is in the retrieved context"],
                ] as [string, string, string][]).map(([key, label, description]) => {
                  const val = evalScores[key];
                  const pct = val != null && !isNaN(val) ? Math.round(val * 100) : null;
                  const color = pct == null ? "var(--text-secondary)" : pct >= 70 ? "#16a34a" : pct >= 40 ? "#d97706" : "#dc2626";
                  const bg = pct == null ? "var(--surface-2)" : pct >= 70 ? "rgba(22,163,74,0.08)" : pct >= 40 ? "rgba(217,119,6,0.08)" : "rgba(220,38,38,0.08)";
                  return (
                    <div key={key} className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: bg, border: `1px solid ${color}30` }} title={description}>
                      <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</span>
                      <span className="text-3xl font-extrabold" style={{ color }}>{pct != null ? `${pct}%` : "—"}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
