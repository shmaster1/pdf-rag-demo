"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Loader2,
  Bot,
  User,
  Paperclip,
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
      {/* Main chat area */}
      <main className="flex flex-1 flex-col min-w-0">
        {/* Chat header */}
        <header
          className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div>
            <h1 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
              {uploadState.status === "success" ? uploadState.fileName : "No document loaded"}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {uploadState.status === "success"
                ? "Ask anything about this document"
                : "Upload a PDF to start chatting"}
            </p>
          </div>
          {uploadState.status !== "success" && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: "var(--accent)", color: "white" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
            >
              <Paperclip size={14} />
              Upload PDF
            </button>
          )}
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
                <div className="text-center max-w-sm">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: "rgba(99,102,241,0.12)" }}
                  >
                    <Bot size={26} style={{ color: "var(--accent)" }} />
                  </div>
                  <p className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>
                    Ready to answer questions
                  </p>
                  <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
                    Ask anything about the uploaded PDF.
                  </p>
                </div>
              )}
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 max-w-3xl ${msg.role === "user" ? "ml-auto flex-row-reverse" : ""}`}
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
                    borderBottomRightRadius: msg.role === "user" ? "4px" : undefined,
                    borderBottomLeftRadius: msg.role === "assistant" ? "4px" : undefined,
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
