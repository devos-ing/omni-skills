---
name: codex-input-preview
description: "Generate a faithful 1200 x 675 Codex-style input composer PNG from a prompt, model label, and reasoning effort. Use when a user wants a shareable Codex prompt mockup, skill invocation example, or simulated Codex input preview."
---

# Codex Input Preview

Generate one PNG that shows a simulated Codex composer. This skill does not
start Codex, call a model, or expose editable source.

Render the user's prompt, model, and reasoning effort exactly as supplied.

## Inputs

Extract exactly these content inputs from the request:

- prompt: required text to display.
- model: required free-form display label.
- effort: one of low, medium, high, or xhigh.

Use `./codex-input-preview.png` unless the user requests another `.png` path.

## Render

Resolve this skill directory, then run:

```bash
node scripts/render-preview.mjs --prompt "<prompt>" --model "<model>" --effort "<effort>" --output "<output>"
```

Pass values as separate process arguments. Do not assemble an executable shell
string. Do not recreate the renderer, write a persistent HTML file, or return
an SVG.

If the renderer reports that the prompt exceeds four lines, ask the user to
shorten it. Preserve all other renderer errors verbatim because they contain
the supported effort values or browser setup guidance.

Return only after the PNG has been verified. Report the absolute output path,
1200 x 675 dimensions, model, and effort. Do not claim the image is a live
Codex session.
