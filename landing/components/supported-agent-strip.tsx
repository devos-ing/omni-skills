import Image from "next/image";
import type { AgentBadgeContent } from "../lib/landing-content";

function AgentFlowIllustration() {
  return (
    <svg
      className="agent-flow-art"
      viewBox="0 0 1120 380"
      role="img"
      aria-label="A user goal enters the Omniskills coordinator and branches to specialist agent environments before converging into a verified result."
    >
      <defs>
        <linearGradient id="flow-surface" x1="130" y1="40" x2="950" y2="330">
          <stop stopColor="#fff" />
          <stop offset="1" stopColor="#e9f4f6" />
        </linearGradient>
        <filter id="flow-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="14" stdDeviation="18" floodColor="#26202f" floodOpacity=".09" />
        </filter>
      </defs>
      <path d="M166 190h216M520 190h130M790 190h164" className="flow-line flow-line-main" />
      <path
        d="M520 190c68 0 56-92 130-92M520 190c68 0 56 92 130 92M790 98c76 0 70 92 164 92M790 282c76 0 70-92 164-92"
        className="flow-line"
      />
      <g className="flow-node" transform="translate(46 140)">
        <rect width="120" height="100" rx="20" fill="#fff" stroke="#d8dee8" />
        <circle cx="60" cy="35" r="13" fill="#ccebed" stroke="#207480" />
        <path d="M36 76c6-17 15-24 24-24s18 7 24 24" fill="none" stroke="#207480" strokeWidth="2" />
        <text x="60" y="92" textAnchor="middle">
          YOUR GOAL
        </text>
      </g>
      <g
        className="flow-node flow-node-primary"
        transform="translate(382 118)"
        filter="url(#flow-shadow)"
      >
        <rect width="138" height="144" rx="26" fill="url(#flow-surface)" stroke="#207480" />
        <path d="m69 26 24 14v28L69 82 45 68V40l24-14Z" fill="#207480" />
        <circle cx="69" cy="54" r="8" fill="#fff" />
        <text x="69" y="109" textAnchor="middle">
          OMNISKILLS
        </text>
        <text x="69" y="126" textAnchor="middle" className="flow-muted">
          COORDINATOR
        </text>
      </g>
      {[98, 190, 282].map((y, index) => (
        <g key={y} className="flow-node" transform={`translate(650 ${y - 42})`}>
          <rect width="140" height="84" rx="18" fill="#fff" stroke="#d8dee8" />
          <circle cx="32" cy="29" r="12" fill={index === 1 ? "#207480" : "#eaf6f7"} />
          <path d="M22 59h96" stroke="#e6e6e6" />
          <text x="54" y="33">
            {["PLAN", "BUILD", "VERIFY"][index]}
          </text>
          <text x="70" y="69" textAnchor="middle" className="flow-muted">
            SPECIALIST SKILL
          </text>
        </g>
      ))}
      <g
        className="flow-node flow-result"
        transform="translate(954 140)"
        filter="url(#flow-shadow)"
      >
        <rect width="120" height="100" rx="20" fill="#26202f" />
        <circle cx="60" cy="37" r="17" fill="#41cd75" />
        <path
          d="m52 37 6 6 11-13"
          fill="none"
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x="60" y="78" textAnchor="middle" fill="#fff">
          VERIFIED
        </text>
        <text x="60" y="92" textAnchor="middle" fill="rgba(255,255,255,.55)">
          RESULT
        </text>
      </g>
    </svg>
  );
}

export function SupportedAgentStrip({
  agents,
  label,
  compatibility,
}: {
  agents: readonly AgentBadgeContent[];
  label: string;
  compatibility: string;
}) {
  return (
    <section aria-labelledby="supported-agents-heading" className="landing-section agent-strip">
      <div className="section-heading section-heading-centered">
        <p id="supported-agents-heading" className="section-label section-label-ruled">
          {label}
        </p>
        <h2 className="editorial-heading">Use the agent environment you already trust.</h2>
        <p>{compatibility}</p>
      </div>
      <ul className="agent-logo-grid" aria-label={label}>
        {agents.map((agent) => (
          <li key={agent.id} className="agent-logo-tile">
            <span className="agent-logo-mark">
              {agent.logoSrc ? (
                <Image src={agent.logoSrc} alt="" width={32} height={32} aria-hidden="true" />
              ) : (
                <span className="agent-logo-fallback" aria-hidden="true">
                  {agent.name.slice(0, 2)}
                </span>
              )}
            </span>
            <span>{agent.name}</span>
          </li>
        ))}
      </ul>
      <div className="agent-flow-frame">
        <AgentFlowIllustration />
      </div>
    </section>
  );
}
