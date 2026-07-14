# Codex Input Preview Omniskills Workflow

Generate a simulated Codex input composer as a 1200 x 675 PNG with exact prompt,
model, and effort labels. The workflow does not start Codex or call a model.

Install the public workflow:

```bash
npx omniskill@latest install codex-input-preview
```

Invoke its entry skill:

```text
$codex-input-preview Draw “Help me announce that I’m joining the Codex team!” using GPT-5.6 with high effort.
```

Validate while authoring:

```bash
rtk bun run dev -- validate examples/workflows/codex-input-preview
```

Refresh the lock after changing the skill:

```bash
rtk bun run dev -- lock examples/workflows/codex-input-preview
```
