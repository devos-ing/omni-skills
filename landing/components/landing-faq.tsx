import type { FaqContent } from "../lib/landing-content";

export function LandingFaq({ items }: { items: readonly FaqContent[] }) {
  return (
    <section id="faq" className="landing-section faq-section" aria-labelledby="faq-heading">
      <div className="section-heading section-heading-centered">
        <p className="section-label">FAQ</p>
        <h2 id="faq-heading" className="editorial-heading">
          Clear answers before install.
        </h2>
        <p>What changes, what stays under your control, and what the team actually does.</p>
      </div>
      <div className="faq-list">
        {items.map((item, index) => {
          const answerId = `faq-answer-${index}`;
          return (
            <details key={item.question} className="faq-item" open={index === 0}>
              <summary aria-controls={answerId}>
                {item.question}
                <span className="faq-toggle" aria-hidden="true" />
              </summary>
              <div id={answerId}>
                <p>{item.answer}</p>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
