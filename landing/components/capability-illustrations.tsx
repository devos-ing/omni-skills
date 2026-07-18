import type { CapabilityId } from "../lib/landing-content";

function IllustrationMarks({ id }: { id: CapabilityId }) {
  switch (id) {
    case "strategy":
      return (
        <>
          <circle cx="80" cy="60" r="36" />
          <circle className="motion-capability" cx="40" cy="60" r="11" />
          <circle cx="116" cy="38" r="11" />
          <circle cx="111" cy="91" r="11" />
        </>
      );
    case "requirements":
      return (
        <>
          <rect x="38" y="25" width="70" height="22" rx="6" />
          <rect className="motion-capability" x="48" y="51" width="70" height="22" rx="6" />
          <rect x="58" y="77" width="70" height="22" rx="6" />
        </>
      );
    case "interface":
      return (
        <>
          <rect x="28" y="22" width="104" height="76" rx="10" />
          <path d="M28 44h104M48 59h35M48 72h55" />
          <circle className="motion-capability" cx="110" cy="76" r="12" />
        </>
      );
    case "architecture":
      return (
        <>
          <path d="M44 60 78 32l38 28-38 30Z" />
          <rect x="27" y="48" width="28" height="24" rx="7" />
          <rect className="motion-capability" x="65" y="18" width="28" height="24" rx="7" />
          <rect x="105" y="48" width="28" height="24" rx="7" />
          <rect x="65" y="80" width="28" height="24" rx="7" />
        </>
      );
    case "verification":
      return (
        <>
          <path d="M80 18 119 34l-8 48-31 24-31-24-8-48Z" />
          <path className="motion-capability" d="m61 61 13 13 26-29" />
        </>
      );
    case "handoffs":
      return (
        <>
          <path d="M45 60h70M101 47l14 13-14 13" />
          <circle cx="34" cy="60" r="14" />
          <circle className="motion-capability" cx="126" cy="60" r="14" />
        </>
      );
  }
}

export function CapabilityIllustration({ id }: { id: CapabilityId }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 160 120" className="capability-art">
      <IllustrationMarks id={id} />
    </svg>
  );
}
