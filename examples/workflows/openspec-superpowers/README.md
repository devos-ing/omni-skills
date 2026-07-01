# OpenSpec + Superpowers GetSuperpower

This example turns the OpenSpec + Superpowers handoff diagram into an installable
GetSuperpower reference.

It models a closed AI-assisted development loop:

1. OpenSpec runs `/opsx:propose` to define scope and generate `proposal.md`,
   `specs/`, and `tasks.md`.
2. The human owner reviews `proposal.md` before implementation planning starts.
3. `tasks.md` hands the approved scope to Superpowers.
4. Superpowers uses `brainstorming` and `writing-plans` to deepen the design and
   split the work into smaller implementation tasks.
5. Implementation runs task by task with TDD, using `specs/` for context.
6. Verification evidence is recorded before delivery is claimed.
7. OpenSpec runs `/opsx:archive` to fold the finished change back into the main
   specs and project knowledge.

The callable entry skill is:

```text
skills/openspec-superpowers/SKILL.md
```

After install and agent restart, invoke:

```text
$openspec-superpowers implement this OpenSpec change
```

## Key Handoff Points

| Stage | Lead | Output |
| --- | --- | --- |
| Proposal and specs | OpenSpec | Change scope, spec docs, and task list |
| Design deepening | Superpowers | Technical details and implementation plan |
| Coding execution | Superpowers | TDD-driven implementation with `specs/` context |
| Quality verification | Superpowers | Verification evidence before delivery |
| Knowledge archive | OpenSpec | Updated specs and project knowledge |

## Dependencies

This GetSuperpower combines local OpenSpec handoff guidance with reusable agent
skills:

- `./skills/openspec-superpowers`
- `./skills/opsx-handoff-review`
- `superpowers:brainstorming`
- `superpowers:writing-plans`
- `mattpocock:tdd`
- `pony-trail`

`getsuperpower install` and `getsuperpower clone` automatically use the Skills CLI to fetch missing
`mattpocock:*` dependencies. If that automatic bootstrap fails, run the same
package install through the CLI and retry:

```bash
bun run dev -- skills install mattpocock/skills
```

## Try It

Validate this GetSuperpower from the repo root:

```bash
bun run dev -- getsuperpower validate examples/workflows/openspec-superpowers
```

List its dependencies:

```bash
bun run dev -- getsuperpower deps examples/workflows/openspec-superpowers
```

Install it into a project:

```bash
bun run dev -- getsuperpower install examples/workflows/openspec-superpowers
bun run dev -- getsuperpower clone examples/workflows/openspec-superpowers
```

`getsuperpower clone <source>` is equivalent to `getsuperpower install <source>`.

Restart the agent app after install so the `$openspec-superpowers` entry skill
and its sub-skills are available.
