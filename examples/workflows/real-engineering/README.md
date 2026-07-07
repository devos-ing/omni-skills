# Real Engineering GetSuperpower

This example combines:

- RTK command discipline
- Ponytrail file-change snapshots
- Superpowers brainstorming and writing-plans
- Matt Pocock engineering skills

`getsuperpower install` automatically uses the Skills CLI to fetch missing
`mattpocock:*` dependencies. If that automatic bootstrap fails, run the same
package install through the CLI and retry:

```bash
bun run dev -- skills install mattpocock/skills
```

Validate this GetSuperpower from the repo root:

```bash
bun run dev -- validate examples/workflows/real-engineering
```

Install it into a project:

```bash
bun run dev -- install examples/workflows/real-engineering
```
