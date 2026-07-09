"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

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
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!copyText) return;
    void navigator.clipboard.writeText(copyText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const linesContent = (
    <div className="min-w-0 space-y-1.5">
      {lines.map((line) => (
        <div
          key={`${line.prefix ?? "line"}-${line.text || "blank"}-${line.dim ? "dim" : "normal"}`}
          className="flex min-w-0 gap-2"
        >
          {line.prefix ? (
            <span className="shrink-0 select-none text-white/25">{line.prefix}</span>
          ) : null}
          <span className={`min-w-0 break-words ${line.dim ? "text-white/35" : "text-white/80"}`}>
            {line.text || "\u00a0"}
          </span>
        </div>
      ))}
    </div>
  );

  const content = (
    <>
      {compact ? null : (
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/60" />
          </div>
          {copyText ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-white/35 transition group-hover:text-white/70">
              {copied ? <Check size={12} className="text-emerald-300" /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </span>
          ) : null}
        </div>
      )}
      {compact ? (
        <div className="flex min-w-0 items-center justify-between gap-3 px-4 py-3 font-mono text-sm">
          {linesContent}
          {copyText ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 font-sans text-xs text-white/42 transition group-hover:border-white/20 group-hover:text-white/72">
              {copied ? <Check size={12} className="text-emerald-300" /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto p-4 font-mono text-sm">{linesContent}</div>
      )}
    </>
  );

  const className = `relative overflow-hidden rounded-lg border border-white/10 bg-[#0d0d0d] ${
    copyText
      ? "group w-full cursor-copy text-left transition hover:border-white/20 hover:bg-white/[0.025]"
      : ""
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
