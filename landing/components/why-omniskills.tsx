"use client";

import { Check, GitBranch, ShieldCheck, Sparkles } from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";
import type { WhyFeatureContent } from "../lib/landing-content";

const featureIcons = [Sparkles, ShieldCheck, GitBranch, Check];

function WhyIllustration({ feature }: { feature: WhyFeatureContent }) {
  return (
    <div className={`why-art why-art-${feature.id}`} aria-hidden="true">
      <div className="why-art-grid" />
      <div className="why-goal-chip">$startup-goal</div>
      <div className="why-coordinator-node">
        <span>01</span>
        <strong>Coordinator</strong>
        <small>{feature.label}</small>
      </div>
      <div className="why-evidence-stack">
        {feature.evidence.map((item, index) => (
          <div key={item}>
            <span>{String(index + 2).padStart(2, "0")}</span>
            <strong>{item}</strong>
            <Check size={14} />
          </div>
        ))}
      </div>
      <svg viewBox="0 0 560 350" focusable="false" aria-hidden="true">
        <path d="M106 82C180 82 166 178 248 178M248 178h82M330 178c60 0 42-96 116-96M330 178h116M330 178c60 0 42 96 116 96" />
      </svg>
    </div>
  );
}

export function WhyOmniskills({ features }: { features: readonly WhyFeatureContent[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = features[selectedIndex] ?? features[0];

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown" || event.key === "ArrowRight")
      nextIndex = (index + 1) % features.length;
    if (event.key === "ArrowUp" || event.key === "ArrowLeft")
      nextIndex = (index - 1 + features.length) % features.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = features.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    setSelectedIndex(nextIndex);
    buttonRefs.current[nextIndex]?.focus();
  }

  if (!selected) return null;

  return (
    <section id="why" className="landing-section why-section" aria-labelledby="why-heading">
      <div className="why-layout">
        <div className="why-copy">
          <p className="section-label">Why Omniskills</p>
          <h2 id="why-heading" className="editorial-heading">
            A system for shipping with agents, not just chatting with them.
          </h2>
          <p className="why-lead">
            Every specialist works from the same decision trail, with your approval where it
            matters.
          </p>
          <div
            role="tablist"
            aria-label="Why Omniskills features"
            className="why-tabs"
            aria-orientation="vertical"
          >
            {features.map((feature, index) => {
              const Icon = featureIcons[index] ?? Sparkles;
              return (
                <button
                  key={feature.id}
                  ref={(node) => {
                    buttonRefs.current[index] = node;
                  }}
                  id={`why-tab-${feature.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selectedIndex === index}
                  aria-controls={`why-panel-${feature.id}`}
                  tabIndex={selectedIndex === index ? 0 : -1}
                  onClick={() => setSelectedIndex(index)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                >
                  <Icon size={16} />
                  <span>{feature.label}</span>
                  <span className="why-tab-index">0{index + 1}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div
          id={`why-panel-${selected.id}`}
          role="tabpanel"
          aria-labelledby={`why-tab-${selected.id}`}
          className="why-canvas"
        >
          <div className="why-canvas-copy">
            <p>Feature 0{selectedIndex + 1}</p>
            <h3>{selected.title}</h3>
            <span>{selected.description}</span>
          </div>
          <WhyIllustration feature={selected} />
        </div>
      </div>
    </section>
  );
}
