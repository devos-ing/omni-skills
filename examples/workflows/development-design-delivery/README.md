# Development Design Delivery GetSuperpower

This example combines product/design shaping with implementation discipline.
Use it when a change needs more than a quick patch: clarify the request, explore
the interface, pressure-test the plan, implement with tests, review the result,
and keep rollback evidence.

The callable entry skill is:

```text
skills/development-design-delivery/SKILL.md
```

After install and agent restart, invoke:

```text
$development-design-delivery build this product feature
```

## Flow

| Stage | Skill | Gate |
| --- | --- | --- |
| Shape success criteria | `superpowers:brainstorming` | Human approval |
| Explore interface options | `mattpocock:design-an-interface` | Human approval |
| Stress-test the requirement | `mattpocock:grill-with-docs` | Human approval |
| Write implementation plan | `superpowers:writing-plans` | None |
| Check architecture boundary | `mattpocock:codebase-design` | None |
| Build with tests | `mattpocock:tdd` | None |
| Debug when blocked | `mattpocock:diagnosing-bugs` | None |
| Review the change | `mattpocock:review` | None |
| Preserve evidence | `pony-trail` | None |

## Dependencies

This GetSuperpower combines reusable agent skills:

- `./skills/development-design-delivery`
- `superpowers:brainstorming`
- `mattpocock:design-an-interface`
- `mattpocock:grill-with-docs`
- `superpowers:writing-plans`
- `mattpocock:codebase-design`
- `mattpocock:tdd`
- `mattpocock:diagnosing-bugs`
- `mattpocock:review`
- `pony-trail`

`getsuperpower install` and `getsuperpower clone` automatically use the Skills
CLI to fetch missing `mattpocock:*` dependencies. If that automatic bootstrap
fails, run the same package install through the CLI and retry:

```bash
bun run dev -- skills install mattpocock/skills
```

## Try It

Validate this GetSuperpower from the repo root:

```bash
bun run dev -- validate examples/workflows/development-design-delivery
```

List its dependencies:

```bash
bun run dev -- deps examples/workflows/development-design-delivery
```

Install it into a project:

```bash
bun run dev -- install examples/workflows/development-design-delivery
bun run dev -- clone examples/workflows/development-design-delivery
```

`clone <source>` is equivalent to `install <source>`.
