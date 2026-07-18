import { OmniskillsMark } from "./startup-team-hero";
import { TerminalBlock } from "./terminal-block";

export function FinalInstallCta({ command, sourceUrl }: { command: string; sourceUrl: string }) {
  return (
    <section className="final-install-cta" aria-labelledby="final-cta-heading">
      <div className="closing-mark">
        <OmniskillsMark compact />
      </div>
      <h2 id="final-cta-heading">Give your next goal a real startup team.</h2>
      <p>
        Install the team once, call one goal, and keep every decision and verification step visible.
      </p>
      <div className="hero-actions">
        <TerminalBlock
          compact
          copyText={command}
          copyLabel="Copy Startup Team install command"
          lines={[{ prefix: "$", text: command }]}
        />
        <a href={sourceUrl}>View source</a>
      </div>
    </section>
  );
}
