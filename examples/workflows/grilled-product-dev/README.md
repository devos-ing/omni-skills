# Grilled Product Dev GetSuperpower

This example GetSuperpower is for product-development requests that are still a
little soft. It uses Matt Pocock's `grilling` skill first to pressure-test the
idea, then hands the approved direction to Superpowers for design and planning.

The flow is intentionally narrow:

1. Grill the request one question at a time until the goal, constraints, and
   success criteria are clear.
2. Use `superpowers:brainstorming` to turn the sharpened direction into an
   approved design.
3. Use `superpowers:writing-plans` to split that design into executable tasks.

The callable entry skill is:

```text
skills/grilled-product-dev/SKILL.md
```

After install and agent restart, invoke:

```text
$grilled-product-dev help me shape this product change
```

## Dependencies

This GetSuperpower combines one Matt Pocock skill with two Superpowers skills:

- `./skills/grilled-product-dev`
- `mattpocock:grilling`
- `superpowers:brainstorming`
- `superpowers:writing-plans`

`getsuperpower install` and `getsuperpower clone` automatically use the Skills
CLI to fetch missing `mattpocock:*` dependencies. If that automatic bootstrap
fails, install the Matt Pocock skills package and retry:

```bash
bun run dev -- skills install mattpocock/skills
```

## Try It

Validate this GetSuperpower from the repo root:

```bash
bun run dev -- validate examples/workflows/grilled-product-dev
```

List its dependencies:

```bash
bun run dev -- deps examples/workflows/grilled-product-dev
```

Install it into a project:

```bash
bun run dev -- install examples/workflows/grilled-product-dev
bun run dev -- clone examples/workflows/grilled-product-dev
```

`clone <source>` is equivalent to `install <source>`.

Restart the agent app after install so the `$grilled-product-dev` entry skill
and its sub-skills are available.
