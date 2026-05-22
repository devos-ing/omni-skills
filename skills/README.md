# Skills Directory

This directory is the default skill pack root for devos.ing.

## Default layout

`skills/`

- `piv-plan/SKILL.md`
- `piv-implement/SKILL.md`
- `piv-review-test/SKILL.md`
- `adhd-docs/SKILL.md`
- `backend-standard/SKILL.md`
- `frontend-standard/SKILL.md`
- `frontend-design/SKILL.md`
- `daily-codebase-maintenance/SKILL.md`
- `typescript-biome-style/SKILL.md`

## Configure a custom skill root

Set `skills.root` in `adhd-ai.config.ts` (or a project override) and keep stage skill paths relative:

```ts
export default {
	skills: {
		root: "/absolute/path/to/skills",
		plan: "piv-plan/SKILL.md",
		implement: "piv-implement/SKILL.md",
		reviewTest: "piv-review-test/SKILL.md",
	},
	projects: [{ id: "default" }],
};
```

Absolute stage paths are also supported:

```ts
skills: {
	root: "/mnt/shared-skills",
	implement: "/opt/company-skills/implement/SKILL.md",
}
```

## Manage skills via CLI

Use the CLI to list, add, update, and remove skill folders under the configured
`skills.root` for the selected project:

```bash
devos skills list [--project <PROJECT_ID>]
devos skills add --title "<TITLE>" --description "<DESCRIPTION>" --content "<CONTENT>" [--project <PROJECT_ID>]
devos skills update <NAME> [--title "<TITLE>"] [--description "<DESCRIPTION>"] [--content "<CONTENT>"] [--project <PROJECT_ID>]
devos skills remove <NAME> [--project <PROJECT_ID>]
```

Generated `SKILL.md` template:

```md
name: <skill title>
description: <skill description>

<skill content>
```

## Using skills from another repository

You can source skills from another repo in three common ways:

1. Clone that repo locally and point `skills.root` to it.
2. Add it as a git submodule and set `skills.root` to the submodule path.
3. Copy selected skill folders into this `skills/` directory.

For reproducibility, pin submodules or clone to a known commit.

## Included Supplemental Standards Skills

These supplemental skills are project-agnostic and can be auto-selected for
planning when issue text matches their domain:

- `backend-standard/SKILL.md`
- `frontend-standard/SKILL.md`
- `typescript-biome-style/SKILL.md`

You can also copy these folders into another shared skill pack and keep
`skills.root` pointed at that location.

## Included Maintenance Skill

`daily-codebase-maintenance/SKILL.md` is for recurring maintenance runs that
apply backend and TypeScript/Biome standards to clean unused code, keep module
boundaries focused, and improve reliability with tests.

## Included Documentation Skill

`adhd-docs/SKILL.md` is for generating and maintaining plain-language, operator-facing documentation that explains workflow behavior and integrations (Linear, GitHub, optional Resend notifications, and Claude/OpenAI Codex runtime options) without exposing secrets.

## Included Frontend Design Skill

`frontend-design/SKILL.md` is for building distinctive, production-grade frontend
interfaces with explicit aesthetic direction and non-generic visual execution.
