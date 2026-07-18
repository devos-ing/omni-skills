import type { StartupStepContent } from "../lib/landing-content";

export function HowStartupTeamWorks({ steps }: { steps: readonly StartupStepContent[] }) {
  return (
    <section id="how-it-works" className="landing-section" aria-labelledby="startup-steps-heading">
      <div className="section-heading section-heading-centered">
        <p className="section-label">How it works</p>
        <h2 id="startup-steps-heading" className="editorial-heading">
          Install once. Invoke one goal. Stay in control.
        </h2>
        <p>Three deliberate steps keep the work understandable from setup to verified release.</p>
      </div>
      <ol className="startup-steps">
        {steps.map((step, index) => (
          <li key={step.title}>
            <span className="step-number">0{index + 1}</span>
            <svg viewBox="0 0 180 72" aria-hidden="true">
              <path d="M12 48h44l18-26 24 39 18-23h52" />
              <circle
                cx={index === 0 ? 56 : index === 1 ? 98 : 146}
                cy={index === 0 ? 48 : index === 1 ? 61 : 38}
                r="6"
              />
            </svg>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
