import type { CapabilityContent } from "../lib/landing-content";
import { CapabilityIllustration } from "./capability-illustrations";

export function CapabilityGrid({ items }: { items: readonly CapabilityContent[] }) {
  return (
    <section
      id="capabilities"
      aria-labelledby="capabilities-heading"
      className="landing-section capability-section"
    >
      <div className="section-heading section-heading-centered">
        <p className="section-label">Capabilities</p>
        <h2 id="capabilities-heading" className="editorial-heading">
          Everything your startup team needs.
        </h2>
        <p>
          Specialized skills, one shared context, and visible quality gates from first decision to
          release.
        </p>
      </div>
      <div className="capability-registry-label">
        <span>Direction to delivery</span>
        <span>{items.length} coordinated capabilities</span>
      </div>
      <div className="capability-grid">
        {items.map((item) => (
          <article key={item.id} className={`capability-card capability-${item.id}`}>
            <span className="capability-icon">
              <CapabilityIllustration id={item.id} />
            </span>
            <span className="capability-copy">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
