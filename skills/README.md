# Skills Directory

This directory is the default skill pack root for ADHD.ai.

## Default layout

`skills/`

- `piv-plan/SKILL.md`
- `piv-implement/SKILL.md`
- `piv-review-test/SKILL.md`
- `adhd-docs/SKILL.md`

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

## Using skills from another repository

You can source skills from another repo in three common ways:

1. Clone that repo locally and point `skills.root` to it.
2. Add it as a git submodule and set `skills.root` to the submodule path.
3. Copy selected skill folders into this `skills/` directory.

For reproducibility, pin submodules or clone to a known commit.

## Included Documentation Skill

`adhd-docs/SKILL.md` is for generating and maintaining plain-language, operator-facing documentation that explains workflow behavior and integrations (Linear, GitHub, optional Resend notifications, and Claude/OpenAI Codex runtime options) without exposing secrets.
