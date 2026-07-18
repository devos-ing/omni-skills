import type { Metadata } from "next";

const canonicalUrl = "https://github.com/devos-ing/omni-skills";
const title = "Startup Team for AI Agents | Omniskills";
const description =
  "Install a coordinated startup skill set for strategy, product, design, engineering, and QA in Codex, Claude, Cursor, OpenCode, Hermes, OpenClaw, and GitHub Copilot.";

export const metadata: Metadata = {
  metadataBase: new URL(canonicalUrl),
  alternates: {
    canonical: "/",
  },
  applicationName: "Omniskills",
  title,
  description,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title,
    description,
    url: canonicalUrl,
    siteName: "Omniskills",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};
