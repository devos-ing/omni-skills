"use client";

import { Check, Sparkles } from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";
import { nextAudienceIndex } from "../lib/audience-tabs";
import type { AudienceStoryContent } from "../lib/landing-content";
import { WorkflowRunDemo } from "./workflow-run-demo";

export function AudienceShowcase({ stories }: { stories: readonly AudienceStoryContent[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedStory = stories[selectedIndex] ?? stories[0];

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const nextIndex = nextAudienceIndex(index, event.key, stories.length);
    if (nextIndex === index && !["Home", "End"].includes(event.key)) return;
    event.preventDefault();
    setSelectedIndex(nextIndex);
    tabRefs.current[nextIndex]?.focus();
  }

  if (!selectedStory) return null;

  return (
    <section
      id="showcase"
      className="landing-section audience-showcase"
      aria-labelledby="audience-heading"
    >
      <div className="section-heading section-heading-centered">
        <p className="section-label">Made for the people shipping the work</p>
        <h2 id="audience-heading" className="editorial-heading">
          One team, shaped around your role.
        </h2>
        <p>Choose where you sit. The same coordinated workflow changes what it emphasizes.</p>
      </div>

      <div role="tablist" aria-label="Startup Team audiences" className="audience-tabs">
        {stories.map((story, index) => (
          <button
            key={story.id}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            id={`audience-tab-${story.id}`}
            type="button"
            role="tab"
            aria-selected={selectedIndex === index}
            aria-controls={`audience-panel-${story.id}`}
            tabIndex={selectedIndex === index ? 0 : -1}
            onClick={() => setSelectedIndex(index)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <span>{story.label}</span>
          </button>
        ))}
      </div>

      <div
        id={`audience-panel-${selectedStory.id}`}
        role="tabpanel"
        aria-labelledby={`audience-tab-${selectedStory.id}`}
        className="audience-product-grid"
      >
        <div className="audience-story">
          <span className="audience-story-icon" aria-hidden="true">
            <Sparkles size={18} />
          </span>
          <p className="audience-story-label">For {selectedStory.label}</p>
          <h3>{selectedStory.promise}</h3>
          <div className="audience-scenarios">
            {selectedStory.outcomes.map((outcome, index) => (
              <article key={outcome} className={index === 0 ? "is-active" : ""}>
                <span className="scenario-number">0{index + 1}</span>
                <p>{outcome}</p>
                <Check size={15} aria-hidden="true" />
              </article>
            ))}
          </div>
          <p className="audience-note">Every handoff stays attached to the same approved brief.</p>
        </div>
        <div className="audience-demo">
          <WorkflowRunDemo />
        </div>
      </div>
    </section>
  );
}
