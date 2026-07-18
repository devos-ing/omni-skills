import type { CSSProperties, ReactNode } from "react";

interface RevealProps {
  as?: "div" | "section";
  children: ReactNode;
  className?: string;
  index?: number;
}

export function Reveal({ as: Tag = "div", children, className = "", index = 0 }: RevealProps) {
  return (
    <Tag
      data-reveal="visible"
      className={`motion-reveal ${className}`.trim()}
      style={{ "--reveal-index": index } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
