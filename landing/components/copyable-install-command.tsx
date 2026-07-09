"use client";

import { Check, Copy, Terminal } from "lucide-react";
import { useState } from "react";

interface CopyableInstallCommandProps {
  command: string;
}

export function CopyableInstallCommand({ command }: CopyableInstallCommandProps) {
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
      aria-label={`Copy install command: ${command}`}
      className="w-full cursor-copy rounded-lg border border-white/10 bg-white/[0.035] p-4 text-left transition hover:border-white/20 hover:bg-white/[0.055]"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/35">
          <Terminal size={13} className="text-emerald-300" />
          install command
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/45 transition hover:border-white/20 hover:text-white/75">
          {copied ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </span>
      </div>
      <code className="block break-words font-mono text-sm leading-6 text-white/72">{command}</code>
    </button>
  );
}
