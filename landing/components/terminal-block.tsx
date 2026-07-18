"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { copyText as writeClipboardText } from "../lib/clipboard";

interface TerminalLine {
  prefix?: string;
  text: string;
  dim?: boolean;
}

interface TerminalBlockProps {
  lines: TerminalLine[];
  copyText?: string;
  copyLabel?: string;
  compact?: boolean;
}

export function TerminalBlock({ lines, copyText, copyLabel, compact = false }: TerminalBlockProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function handleCopy() {
    if (!copyText) return;
    const copied = await writeClipboardText(copyText, navigator.clipboard);
    setCopyStatus(copied ? "copied" : "failed");
    if (copied) window.setTimeout(() => setCopyStatus("idle"), 1600);
  }

  const copyStatusLabel =
    copyStatus === "copied"
      ? "Copied"
      : copyStatus === "failed"
        ? "Select and copy command"
        : "Copy";

  const linesContent = (
    <div className="min-w-0 space-y-1.5">
      {lines.map((line) => (
        <div
          key={`${line.prefix ?? "line"}-${line.text || "blank"}-${line.dim ? "dim" : "normal"}`}
          className="flex min-w-0 gap-2"
        >
          {line.prefix ? (
            <span className="shrink-0 select-none text-[var(--muted)]">{line.prefix}</span>
          ) : null}
          <span
            className={`min-w-0 break-words ${line.dim ? "text-[var(--muted)]" : "text-[var(--ink)]"}`}
          >
            {line.text || "\u00a0"}
          </span>
        </div>
      ))}
    </div>
  );

  const content = (
    <>
      {compact ? null : (
        <div className="flex items-center justify-between border-b border-[var(--rule)] px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/60" />
          </div>
          {copyText ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--body)] transition-colors group-hover:text-[var(--ink)]">
              {copyStatus === "copied" ? (
                <Check size={12} className="text-emerald-300" />
              ) : (
                <Copy size={12} />
              )}
              {copyStatusLabel}
            </span>
          ) : null}
        </div>
      )}
      {compact ? (
        <div className="flex min-w-0 items-center justify-between gap-3 px-4 py-3 font-mono text-sm">
          {linesContent}
          {copyText ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--rule)] px-2 py-1 font-sans text-xs font-medium text-[var(--body)] transition-colors group-hover:text-[var(--ink)]">
              {copyStatus === "copied" ? (
                <Check size={12} className="text-emerald-300" />
              ) : (
                <Copy size={12} />
              )}
              {copyStatusLabel}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto p-4 font-mono text-sm">{linesContent}</div>
      )}
    </>
  );

  const className = `editorial-control relative overflow-hidden rounded-md border border-[var(--rule)] bg-[var(--paper)] ${
    copyText ? "group w-full cursor-copy text-left hover:bg-white" : ""
  }`;

  if (copyText) {
    return (
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copyLabel ?? `Copy command: ${copyText}`}
        className={className}
      >
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
