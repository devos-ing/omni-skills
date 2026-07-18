# Attributions

This landing app ports the visual and content direction from the downloaded
Figma export "Create Omniskill Workflows" at:

https://www.figma.com/design/DMQ1Y2sETB8Scq9gwyMiZW/Create-Omniskill-Workflows

The original export included notes for shadcn/ui and Unsplash assets. This
Next.js implementation does not copy shadcn/ui source components or Unsplash
images, but the source-design attribution is preserved here for auditability.

## Supported agent marks

| Asset | Source | Use |
| --- | --- | --- |
| Cursor | Local checked-in SVG under `landing/public/agent-logos/cursor.svg` | Supported-agent identification |
| Codex | Local checked-in OpenAI SVG under `landing/public/agent-logos/openai.svg` | Supported-agent identification |
| Claude | Local checked-in SVG under `landing/public/agent-logos/claude.svg` | Supported-agent identification |
| GitHub Copilot | Local checked-in SVG under `landing/public/agent-logos/github-copilot.svg` | Supported-agent identification |

OpenCode, Hermes, and OpenClaw use neutral text tiles on the landing page in
this revision because network access was unavailable for verifying official
brand assets during implementation.

## Typography

Geist Sans and Geist Mono are provided by Vercel through the `geist` npm
package. The font software is licensed under the SIL Open Font License 1.1.

- Project: https://github.com/vercel/geist-font
- License: https://github.com/vercel/geist-font/blob/main/OFL.txt
