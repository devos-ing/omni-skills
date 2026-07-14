# Real Engineering Omniskills Workflow

This example combines:

- RTK command discipline
- Superpowers brainstorming, writing-plans, and verification
- Matt Pocock engineering skills

`omniskill install` automatically uses the Skills CLI to fetch missing
`mattpocock:*` dependencies. If that automatic bootstrap fails, run the same
package install through the CLI and retry:

```bash
bun run dev -- skills install mattpocock/skills
```

Validate this Omniskills workflow from the repo root:

```bash
bun run dev -- validate examples/workflows/real-engineering
```

Install it into a project:

```bash
bun run dev -- install examples/workflows/real-engineering
```
