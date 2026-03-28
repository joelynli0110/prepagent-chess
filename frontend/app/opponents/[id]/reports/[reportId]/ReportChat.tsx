"use client";

import { useEffect, useRef, useState } from "react";
import { apiPost } from "@/lib/api";
import { Markdown } from "./Markdown";

interface Message {
  role: "user" | "assistant";
  text: string;
}

const SUGGESTIONS = [
  "Which opening should I play against this opponent?",
  "How does this opponent react under time pressure?",
  "What is their biggest weakness?",
  "What should I avoid in this matchup?",
];

export function ReportChat({
  opponentId,
  reportId,
}: {
  opponentId: string;
  reportId: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setLoading(true);

    try {
      const data = await apiPost<{ reply: string }>(
        `/opponents/${opponentId}/reports/${reportId}/chat`,
        { message: trimmed }
      );
      setMessages((prev) => [...prev, { role: "assistant", text: data.reply }]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Error: could not get a response. Try again." },
      ]);
      console.error(e);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Ask the Report</h2>

      <div className="rounded-2xl border overflow-hidden flex flex-col" style={{ height: "520px" }}>
        {/* Message list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
              <p className="text-sm text-gray-400">
                Ask anything about this opponent based on the report data.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-xl border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === "user"
                      ? "bg-gray-900 text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  }`}
                >
                  {msg.role === "user" ? (
                    msg.text
                  ) : (
                    <Markdown>{msg.text}</Markdown>
                  )}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2.5">
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
                </span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t p-3 flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about openings, weaknesses, time pressure… (Enter to send)"
            rows={2}
            className="flex-1 resize-none rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </section>
  );
}
