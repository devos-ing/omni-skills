"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

interface RevealProps {
  as?: "div" | "section";
  children: ReactNode;
  className?: string;
  index?: number;
}

type RevealState = "visible" | "pending";

export function Reveal({ as: Tag = "div", children, className = "", index = 0 }: RevealProps) {
  const elementRef = useRef<HTMLElement>(null);
  const [state, setState] = useState<RevealState>("visible");

  useEffect(() => {
    const element = elementRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!element || reduceMotion || !("IntersectionObserver" in window)) return;

    setState("pending");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setState("visible");
        observer.disconnect();
      },
      { rootMargin: "0px 0px -8%", threshold: 0.08 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={elementRef as never}
      data-reveal={state}
      className={`motion-reveal ${className}`.trim()}
      style={{ "--reveal-index": index } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
