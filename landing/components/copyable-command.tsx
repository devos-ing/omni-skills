"use client";

import { Check, Copy, Terminal } from "lucide-react";
import { useState } from "react";

interface CopyableCommandProps {
  command: string;
  label: string;
}

export function CopyableCommand({ command, label }: CopyableCommandProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy ${label}: ${command}`}
      className="editorial-control w-full cursor-copy rounded-md border border-[var(--rule)] bg-[var(--paper)] p-4 text-left"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          <Terminal size={13} className="text-emerald-300" />
          {label}
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--rule)] px-2.5 py-1.5 text-xs font-medium text-[var(--body)] transition-colors hover:text-[var(--ink)]">
          {copied ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </span>
      </div>
      <code className="block break-words font-mono text-sm leading-6 text-[var(--ink)]">
        {command}
      </code>
    </button>
  );
}
