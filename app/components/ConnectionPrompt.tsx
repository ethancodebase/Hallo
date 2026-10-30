"use client";

import { wispColor, wispName } from "@/lib/wisps";

// Reusable centered prompt for "someone wants to connect" and
// "someone wants to start video".
export default function ConnectionPrompt({
  peerId,
  title,
  subtitle,
  acceptLabel,
  declineLabel,
  onAccept,
  onDecline,
}: {
  peerId?: string;
  title: string;
  subtitle?: string;
  acceptLabel: string;
  declineLabel: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const wisp = {
    "--wisp": peerId ? wispColor(peerId) : "#fde3a7",
  } as React.CSSProperties;

  return (
    <div className="prompt-backdrop absolute inset-0 z-20 flex items-center justify-center bg-[#050a1e]/70 p-6 backdrop-blur-[2px]">
      <div
        role="alertdialog"
        aria-label={title}
        style={wisp}
        className="prompt-in relative w-full max-w-sm overflow-hidden rounded-2xl border border-amber-200/30 bg-gradient-to-b from-[#241645]/95 to-[#0d0a24]/95 p-6 text-center text-violet-100 shadow-[0_0_60px_rgba(196,161,255,0.35)]"
      >
        <span aria-hidden className="prompt-glow pointer-events-none absolute inset-x-0 -top-16 mx-auto h-40 w-40 rounded-full" />

        <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
          <span aria-hidden className="prompt-ring absolute inset-0 rounded-full" />
          <span className="ledger-wisp scale-150" />
        </div>

        {peerId && (
          <p className="relative mt-3 font-fantasy text-xs tracking-[0.2em] text-violet-300/80">
            {wispName(peerId).toUpperCase()}
          </p>
        )}
        <h2 className="relative mt-1 font-fantasy text-lg font-bold tracking-wide text-amber-100">
          {title}
        </h2>
        {subtitle && (
          <p className="relative mt-1.5 text-sm leading-relaxed text-violet-200/85">
            {subtitle}
          </p>
        )}

        <div className="relative mt-6 flex gap-3">
          <button
            onClick={onDecline}
            className="flex-1 rounded-full border border-violet-300/30 px-4 py-2.5 text-sm text-violet-200 transition hover:border-violet-200/60 hover:bg-violet-300/10 hover:text-violet-50"
          >
            {declineLabel}
          </button>
          <button
            onClick={onAccept}
            autoFocus
            className="flex-1 rounded-full bg-gradient-to-r from-amber-200 to-amber-300 px-4 py-2.5 font-fantasy text-sm font-bold tracking-[0.08em] text-[#2a1846] shadow-[0_0_20px_rgba(253,227,167,0.45)] transition hover:from-amber-100 hover:to-amber-200 hover:shadow-[0_0_30px_rgba(253,227,167,0.65)]"
          >
            ✦ {acceptLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
