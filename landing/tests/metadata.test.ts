import { describe, expect, test } from "bun:test";
import { metadata } from "../app/metadata";

const canonicalUrl = "https://github.com/devos-ing/omni-skills";
const seoTitle = "Startup Team for AI Agents | Omniskills";
const seoDescription =
  "Install a coordinated startup skill set for strategy, product, design, engineering, and QA in Codex, Claude, Cursor, OpenCode, Hermes, OpenClaw, and GitHub Copilot.";

describe("landing metadata", () => {
  test("describes Omniskills for search and social previews", () => {
    expect(metadata.metadataBase?.toString()).toBe(canonicalUrl);
    expect(metadata.alternates?.canonical).toBe("/");
    expect(metadata.applicationName).toBe("Omniskills");
    expect(metadata.title).toBe(seoTitle);
    expect(metadata.description).toBe(seoDescription);
    expect(metadata.robots).toEqual({
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    });
    expect(metadata.openGraph).toEqual({
      title: seoTitle,
      description: seoDescription,
      url: canonicalUrl,
      siteName: "Omniskills",
      type: "website",
      locale: "en_US",
    });
    expect(metadata.twitter).toEqual({
      card: "summary",
      title: seoTitle,
      description: seoDescription,
    });
  });
});
