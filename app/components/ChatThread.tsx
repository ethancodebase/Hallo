"use client";

import { useEffect, useRef, useState } from "react";

export interface ChatMessage {
  id: number;
  mine: boolean;
  text: string;
}

export default function ChatThread({
  messages,
  connected,
  onSend,
  emptyState,
  compact = false,
}: {
  messages: ChatMessage[];
  connected: boolean;
  onSend: (text: string) => boolean;
  emptyState?: React.ReactNode;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll only the thread itself; scrollIntoView would also shift the
  // fixed page layout behind the video call.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !connected) return;
    if (onSend(text)) setDraft("");
  }

  return (
    <>
      <div
        ref={scrollRef}
        className={`ledger-scroll min-h-0 flex-1 overflow-y-auto ${
          compact ? "space-y-2 p-3" : "space-y-2.5 p-4"
        }`}
      >
        {messages.length === 0 && emptyState}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`chat-bubble-in flex ${m.mine ? "justify-end" : "justify-start"}`}
          >
            <span
              className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                m.mine
                  ? "rounded-br-md bg-gradient-to-br from-amber-100 to-amber-300 text-[#2a1846] shadow-[0_0_16px_rgba(253,227,167,0.25)]"
                  : "chat-bubble-theirs rounded-bl-md text-violet-50"
              }`}
            >
              {m.text}
            </span>
          </div>
        ))}
      </div>

      <form
        onSubmit={submit}
        className={`flex gap-2 border-t border-violet-300/15 bg-black/20 ${
          compact ? "p-2" : "p-3"
        }`}
      >
        <input
          value={draft}
          maxLength={2000}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={connected ? "Whisper a message…" : "Weaving the connection…"}
          disabled={!connected}
          className="min-w-0 flex-1 rounded-full border border-violet-300/20 bg-white/5 px-4 py-2 text-sm text-violet-50 outline-none transition placeholder:text-violet-300/50 focus:border-amber-200/60 focus:shadow-[0_0_14px_rgba(253,227,167,0.2)] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!connected || !draft.trim()}
          className="shrink-0 rounded-full bg-gradient-to-r from-amber-200 to-amber-300 px-4 py-2 font-fantasy text-xs font-bold tracking-[0.12em] text-[#2a1846] shadow-[0_0_16px_rgba(253,227,167,0.35)] transition hover:from-amber-100 hover:to-amber-200 disabled:opacity-40 disabled:shadow-none"
        >
          Send ✦
        </button>
      </form>
    </>
  );
}
