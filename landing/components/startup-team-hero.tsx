import { ArrowUpRight, Github } from "lucide-react";
import type { StartupLandingContent } from "../lib/landing-content";
import { TerminalBlock } from "./terminal-block";

export function OmniskillsMark({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={compact ? "omniskills-mark omniskills-mark-compact" : "omniskills-mark"}
      viewBox="0 0 116 116"
      focusable="false"
    >
      <defs>
        <linearGradient id={compact ? "omni-a-small" : "omni-a"} x1="12" y1="9" x2="99" y2="107">
          <stop offset="0" stopColor="#d9fbff" />
          <stop offset="0.43" stopColor="#56a9b6" />
          <stop offset="1" stopColor="#20303d" />
        </linearGradient>
        <linearGradient id={compact ? "omni-b-small" : "omni-b"} x1="98" y1="18" x2="30" y2="99">
          <stop offset="0" stopColor="#f6e8ff" />
          <stop offset="0.5" stopColor="#9da8ed" />
          <stop offset="1" stopColor="#207480" />
        </linearGradient>
      </defs>
      <path
        d="M58 6 101 31v50L58 106 15 81V31L58 6Z"
        fill={`url(#${compact ? "omni-a-small" : "omni-a"})`}
        stroke="rgba(255,255,255,.86)"
        strokeWidth="2"
      />
      <path
        d="m58 6 1 48 42-23M59 54l42 27M59 54 15 31m44 23L15 81"
        fill="none"
        stroke="rgba(255,255,255,.58)"
        strokeWidth="1.5"
      />
      <path
        d="m58 31 22 13v27L58 84 36 71V44l22-13Z"
        fill={`url(#${compact ? "omni-b-small" : "omni-b"})`}
        stroke="rgba(255,255,255,.82)"
        strokeWidth="2"
      />
      <circle cx="58" cy="57.5" r="8" fill="#fff" fillOpacity=".94" />
    </svg>
  );
}

export function StartupTeamHero({
  content,
  githubStarsLabel,
  githubUrl,
}: {
  content: StartupLandingContent;
  githubStarsLabel: string;
  githubUrl: string;
}) {
  return (
    <section id="top" className="startup-hero" aria-labelledby="hero-heading">
      <div className="hero-emblem" aria-hidden="true">
        <span className="hero-emblem-orbit" />
        <OmniskillsMark />
      </div>
      <p className="hero-kicker">{content.eyebrow}</p>
      <h1 id="hero-heading">{content.headline}</h1>
      <p className="hero-lead">{content.lead}</p>
      <div className="hero-actions">
        <TerminalBlock
          compact
          copyText={content.installCommand}
          copyLabel="Copy Startup Team install command"
          lines={[{ prefix: "$", text: content.installCommand }]}
        />
        <a
          href={githubUrl}
          className="secondary-action"
          aria-label={`View on GitHub, ${githubStarsLabel}`}
        >
          <Github size={16} /> {content.githubLabel} <ArrowUpRight size={13} />
        </a>
      </div>
      <p className="hero-proof">
        <span aria-hidden="true" /> Works across seven supported agent environments
      </p>
    </section>
  );
}
