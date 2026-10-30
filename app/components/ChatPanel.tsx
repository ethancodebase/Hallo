"use client";

import { useEffect, useRef, useState } from "react";
import { wispColor, wispName } from "@/lib/wisps";

export interface ChatMessage {
  id: number;
  mine: boolean;
  text: string;
}

export default function ChatPanel({
  peerId,
  messages,
  connected,
  videoBusy,
  onSend,
  onStartVideo,
  onEnd,
}: {
  peerId: string;
  messages: ChatMessage[];
  connected: boolean;
  videoBusy: boolean;
  onSend: (text: string) => void;
  onStartVideo: () => void;
  onEnd: () => void;
}) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const name = wispName(peerId);
  const wisp = { "--wisp": wispColor(peerId) } as React.CSSProperties;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !connected) return;
    onSend(text);
    setDraft("");
  }

  return (
    <div
      style={wisp}
      className="chat-in absolute inset-y-0 right-0 z-20 flex w-full max-w-md flex-col border-l border-amber-200/20 bg-gradient-to-b from-[#1c1238]/95 via-[#120c2c]/95 to-[#0a0820]/95 text-violet-100 shadow-[0_0_60px_rgba(124,92,220,0.35)] backdrop-blur-md"
    >
      <header className="flex items-center justify-between gap-3 border-b border-violet-300/15 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="chat-peer-badge flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <span className={`ledger-wisp ${connected ? "" : "animate-pulse"}`} />
          </span>
          <div className="min-w-0">
            <p className="truncate font-fantasy text-sm font-bold tracking-wide text-violet-50">
              {name}
            </p>
            <p className="text-[11px] italic text-violet-300/80">
              {connected
                ? "Bound by a thread of light"
                : "Weaving the connection…"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={onStartVideo}
            disabled={!connected || videoBusy}
            title="Start a video call"
            className="rounded-full border border-violet-300/30 px-3 py-1.5 text-xs text-violet-100 transition hover:border-amber-200/60 hover:text-amber-100 disabled:opacity-40"
          >
            ✧ Video
          </button>
          <button
            onClick={onEnd}
            title="End the conversation"
            className="rounded-full border border-rose-300/40 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/30"
          >
            Part ways
          </button>
        </div>
      </header>

      <div className="ledger-scroll flex-1 space-y-2.5 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="mt-10 text-center">
            <p className="font-fantasy text-sm tracking-wide text-amber-100/90">
              ✦ A thread of light connects you ✦
            </p>
            <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-violet-300/80">
              Whisper a greeting. Your words travel spirit to spirit — never
              kept, never stored.
            </p>
          </div>
        )}
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
        <div ref={endRef} />
      </div>

      <form
        onSubmit={submit}
        className="flex gap-2 border-t border-violet-300/15 bg-black/20 p-3"
      >
        <input
          value={draft}
          maxLength={2000}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={connected ? "Whisper a message…" : "Weaving the connection…"}
          disabled={!connected}
          className="flex-1 rounded-full border border-violet-300/20 bg-white/5 px-4 py-2 text-sm text-violet-50 outline-none transition placeholder:text-violet-300/50 focus:border-amber-200/60 focus:shadow-[0_0_14px_rgba(253,227,167,0.2)] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!connected || !draft.trim()}
          className="rounded-full bg-gradient-to-r from-amber-200 to-amber-300 px-4 py-2 font-fantasy text-xs font-bold tracking-[0.12em] text-[#2a1846] shadow-[0_0_16px_rgba(253,227,167,0.35)] transition hover:from-amber-100 hover:to-amber-200 disabled:opacity-40 disabled:shadow-none"
        >
          Send ✦
        </button>
      </form>
    </div>
  );
}
