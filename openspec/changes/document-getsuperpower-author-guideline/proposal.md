# Proposal: Document GetSuperpower Authoring Guideline

## Summary

Make the authoring path obvious for people who want to create their own
GetSuperpower workflow and skills set. The guide should tell authors to call the
bundled `$creating-bundle-skills` skill first, then use the CLI scaffold and
validation commands to create a shareable workflow.

## Motivation

The current author guide explains the file structure, but the recommended
agent-assisted path is easy to miss. New authors should not need to infer how an
entry skill, local sub-skills, and `workflow.json` fit together.

## Scope

In scope:

- Make `$creating-bundle-skills` the recommended first step in the author guide.
- Add a copyable prompt authors can give to their agent.
- Explain the expected outputs from the authoring skill.
- Keep the manual scaffold, manifest, entry-skill, validation, install/clone,
  and sharing steps.

Out of scope:

- Changing CLI behavior.
- Adding a hosted registry.
- Changing the GetSuperpower manifest schema.

## Acceptance Criteria

- README points authors to `$creating-bundle-skills` and says what it should do.
- `docs/workflow-author-guide.md` gives a clear install-call-create-validate
  path for a custom GetSuperpower.
- The guide explains that the created workflow must include a callable entry
  skill that orchestrates its required sub-skills.
- `rtk bun run check` passes.
