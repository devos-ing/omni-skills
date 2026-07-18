"use client";

import { Check, Copy, Terminal } from "lucide-react";
import { useState } from "react";
import { copyText } from "../lib/clipboard";

interface CopyableCommandProps {
  command: string;
  label: string;
  copyLabel: string;
}

export function CopyableCommand({ command, label, copyLabel }: CopyableCommandProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function handleCopy() {
    const copied = await copyText(command, navigator.clipboard);
    setCopyStatus(copied ? "copied" : "failed");
    if (copied) window.setTimeout(() => setCopyStatus("idle"), 1600);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`${copyLabel}: ${command}`}
      className="editorial-control w-full cursor-copy rounded-md border border-[var(--rule)] bg-[var(--paper)] p-4 text-left"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          <Terminal size={13} className="text-emerald-300" />
          {label}
        </div>
        <span
          aria-live="polite"
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--rule)] px-2.5 py-1.5 text-xs font-medium text-[var(--body)] transition-colors hover:text-[var(--ink)]"
        >
          {copyStatus === "copied" ? (
            <Check size={13} className="text-emerald-300" />
          ) : (
            <Copy size={13} />
          )}
          {copyStatus === "copied"
            ? "Copied"
            : copyStatus === "failed"
              ? "Select and copy command"
              : "Copy"}
        </span>
      </div>
      <code className="block break-words font-mono text-sm leading-6 text-[var(--ink)]">
        {command}
      </code>
    </button>
  );
}
