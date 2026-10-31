"use client";

import { wispColor, wispName } from "@/lib/wisps";
import ChatThread, { type ChatMessage } from "./ChatThread";

export type { ChatMessage };

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
  onSend: (text: string) => boolean;
  onStartVideo: () => void;
  onEnd: () => void;
}) {
  const name = wispName(peerId);
  const wisp = { "--wisp": wispColor(peerId) } as React.CSSProperties;

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

      <ChatThread
        messages={messages}
        connected={connected}
        onSend={onSend}
        emptyState={
          connected ? (
            <div className="mt-10 text-center">
              <p className="font-fantasy text-sm tracking-wide text-amber-100/90">
                ✦ A thread of light connects you ✦
              </p>
              <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-violet-300/80">
                Whisper a greeting. Your words travel spirit to spirit — never
                kept, never stored.
              </p>
            </div>
          ) : (
            <div className="mt-10 text-center">
              <p className="animate-pulse font-fantasy text-sm tracking-wide text-violet-200/90">
                ✦ Weaving the thread of light… ✦
              </p>
              <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-violet-300/80">
                Reaching the stranger directly. Messages can be sent once the
                thread is bound.
              </p>
            </div>
          )
        }
      />
    </div>
  );
}
