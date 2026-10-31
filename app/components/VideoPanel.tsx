"use client";

import { useEffect, useRef, useState } from "react";
import { wispName } from "@/lib/wisps";
import ChatThread, { type ChatMessage } from "./ChatThread";

// A plain transform, not the `scale` property: some mobile browsers render a
// negative `scale` on <video> skewed or not at all.
const MIRROR: React.CSSProperties = { transform: "scaleX(-1)" };

// Autoplay with sound can be refused (notably iOS Safari); report it so the
// user can start playback with a tap instead of seeing a frozen black frame.
function attach(
  el: HTMLVideoElement | null,
  stream: MediaStream | null,
  muted: boolean,
  onBlocked: () => void,
) {
  if (!el) return;
  // Set imperatively: React doesn't reliably update `muted` after mount, and
  // your own audio must never play back to you.
  el.muted = muted;
  if (el.srcObject !== stream) el.srcObject = stream;
  if (stream) el.play().catch((err) => {
    if (err instanceof DOMException && err.name === "NotAllowedError") onBlocked();
  });
}

export default function VideoPanel({
  peerId,
  localStream,
  remoteStream,
  messages,
  connected,
  onSend,
  onEnd,
}: {
  peerId: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  messages: ChatMessage[];
  connected: boolean;
  onSend: (text: string) => boolean;
  onEnd: () => void;
}) {
  const mainRef = useRef<HTMLVideoElement>(null);
  const pipRef = useRef<HTMLVideoElement>(null);
  // The stranger is always the main view unless the user taps the corner
  // preview to swap.
  const [swapped, setSwapped] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const mainStream = swapped ? localStream : remoteStream;
  const pipStream = swapped ? remoteStream : localStream;
  // Side-by-side chat fits on wide screens; on phones it would cover the face.
  const [chatOpen, setChatOpen] = useState(
    () => window.matchMedia("(min-width: 768px)").matches,
  );
  const [seenCount, setSeenCount] = useState(messages.length);
  const unread = chatOpen
    ? 0
    : messages.slice(seenCount).filter((m) => !m.mine).length;

  useEffect(() => {
    attach(mainRef.current, mainStream, swapped, () => setNeedsTap(true));
  }, [mainStream, swapped]);

  useEffect(() => {
    attach(pipRef.current, pipStream, !swapped, () => setNeedsTap(true));
  }, [pipStream, swapped]);

  function resumePlayback() {
    setNeedsTap(false);
    for (const v of [mainRef.current, pipRef.current]) {
      v?.play().catch(() => {});
    }
  }

  function toggleChat() {
    if (chatOpen) setSeenCount(messages.length);
    setChatOpen(!chatOpen);
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-black">
      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1 overflow-hidden">
          {/* Main view: contain, never crop, so the whole face stays in frame
              whatever the aspect ratio of either screen. */}
          <video
            ref={mainRef}
            autoPlay
            playsInline
            style={swapped ? MIRROR : undefined}
            className="h-full w-full bg-zinc-950 object-contain"
          />
          {!mainStream && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-zinc-500">
              Waiting for {wispName(peerId)}&rsquo;s video…
            </div>
          )}

          <div className="pointer-events-none absolute left-3 top-3 max-w-[50%] truncate rounded-full bg-black/50 px-3 py-1 text-xs text-zinc-100 backdrop-blur">
            {swapped ? "You" : wispName(peerId)}
          </div>

          {needsTap && (
            <button
              onClick={resumePlayback}
              className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-semibold text-zinc-100"
            >
              Tap to start video
            </button>
          )}

          {/* Corner preview; only your own camera is mirrored. Tap to swap. */}
          <button
            onClick={() => setSwapped(!swapped)}
            title="Swap views"
            className="absolute right-3 top-3 aspect-[3/4] w-24 overflow-hidden rounded-xl border border-white/20 bg-zinc-800 shadow-lg sm:w-32 md:aspect-video md:w-48 lg:w-56"
          >
            <video
              ref={pipRef}
              autoPlay
              playsInline
              muted
              style={swapped ? undefined : MIRROR}
              className="h-full w-full object-cover"
            />
            <span className="pointer-events-none absolute bottom-1 left-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-zinc-100">
              {swapped ? wispName(peerId) : "You"}
            </span>
          </button>
        </div>

        {chatOpen && (
          <aside className="absolute inset-x-0 bottom-0 z-10 flex h-[55%] flex-col border-t border-violet-300/20 bg-[#120c2c]/90 text-violet-100 backdrop-blur-md md:static md:h-auto md:w-80 md:border-l md:border-t-0 lg:w-96">
            <div className="flex items-center justify-between border-b border-violet-300/15 px-3 py-2">
              <p className="font-fantasy text-xs font-bold tracking-wide text-violet-50">
                Chat
              </p>
              <button
                onClick={toggleChat}
                aria-label="Hide chat"
                className="rounded-full px-2 text-lg leading-none text-violet-300 hover:text-violet-50"
              >
                ×
              </button>
            </div>
            <ChatThread
              compact
              messages={messages}
              connected={connected}
              onSend={onSend}
              emptyState={
                <p className="mt-6 text-center text-xs text-violet-300/70">
                  Messages sent here appear in the chat too.
                </p>
              }
            />
          </aside>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 bg-zinc-950 px-4 py-3">
        <button
          onClick={toggleChat}
          aria-pressed={chatOpen}
          className={`relative rounded-full px-5 py-2.5 text-sm font-semibold transition ${
            chatOpen
              ? "bg-violet-500/30 text-violet-50"
              : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
          }`}
        >
          Chat
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-300 px-1 text-[11px] font-bold text-[#2a1846]">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
        <button
          onClick={onEnd}
          className="rounded-full bg-red-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-red-400"
        >
          End video
        </button>
      </div>
    </div>
  );
}
