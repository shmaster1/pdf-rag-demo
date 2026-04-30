"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Loader2,
  Bot,
  User,
  Upload,
  AlertCircle,
} from "lucide-react";

const API_BASE = "/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface UploadState {
  status: "idle" | "uploading" | "success" | "error";
  fileName?: string;
  error?: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const uploadPDF = useCallback(async (file: File) => {
    if (!file.name.endsWith(".pdf")) {
      setUploadState({ status: "error", error: "Only PDF files are accepted." });
      return;
    }

    setUploadState({ status: "uploading", fileName: file.name });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/pdf_converter`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();
      if (data.errors?.length) {
        setUploadState({ status: "error", fileName: file.name, error: data.errors[0] });
      } else {
        setUploadState({ status: "success", fileName: file.name });
        setMessages([]);
        setShowToast(true);
      }
    } catch (err) {
      setUploadState({
        status: "error",
        fileName: file.name,
        error: err instanceof Error ? err.message : "Upload failed",
      });
    }
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
    setUploadState({ status: "idle" });
    setMessages([]);
  };

  return (
    <div className="flex h-full" style={{ background: "var(--background)" }}>
      {/* Toast */}
      {showConfirm && (
        <div
          className="fixed top-4 left-1/2 z-50 flex items-center gap-4 px-5 py-4 rounded-2xl shadow-xl text-sm"
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
          <div className="flex items-center gap-2 flex-shrink-0">
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
          className="flex items-center justify-between px-6 py-5 border-b flex-shrink-0"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          {/* Spacer (balances the right side) */}
          <div className="w-48 flex-shrink-0" />

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
              <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
                sha<span style={{ color: "var(--accent)" }}>pdf</span>
              </h1>
            </div>
            <p className="text-xs tracking-wide" style={{ color: "var(--text-secondary)" }}>
              Chat with your documents, instantly
            </p>
          </div>

          {/* PDF thumbnail — right side */}
          <div className="w-48 flex-shrink-0 flex justify-end">
            {uploadState.status === "success" && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(99,102,241,0.12)" }}
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                    <path d="M4 3h8l4 4v10a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
                    <path d="M12 3v4h4" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M7 10h6M7 13h4" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <span
                  className="text-xs font-medium truncate max-w-24"
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
        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-4">
          {messages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              {uploadState.status !== "success" ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-4 rounded-2xl p-12 cursor-pointer transition-all max-w-sm w-full"
                  style={{
                    border: `2px dashed ${isDragging ? "var(--accent)" : "var(--border)"}`,
                    background: isDragging ? "rgba(99,102,241,0.06)" : "transparent",
                  }}
                >
                  {uploadState.status === "uploading" ? (
                    <>
                      <Loader2 size={32} className="animate-spin" style={{ color: "var(--accent)" }} />
                      <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
                        Processing <span className="font-medium" style={{ color: "var(--text-primary)" }}>{uploadState.fileName}</span>…
                      </p>
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
                className="flex gap-3 max-w-3xl"
              >
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
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
                  className="rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-lg"
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
            <div className="flex gap-3 max-w-3xl">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
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
          className="px-6 py-4 border-t flex-shrink-0"
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
          <p className="text-xs mt-2 text-center" style={{ color: "var(--text-secondary)" }}>
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileInput}
      />
    </div>
  );
}
