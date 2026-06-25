---
name: ponyrace
description: Use when the user invokes /ponyrace, asks to run a pony race, wants role ponies to discuss whether a requirement direction matches their request, or wants Ponyrace's CLI requirement discussion before implementation.
---

# Ponyrace

## Overview

Run Ponyrace's CLI requirement discussion before implementation. The skill makes `/ponyrace ...` a chat trigger for the existing `ponyrace ponyrace` command; the CLI remains the source of truth for clarification, role-pony discussion, vote tallying, Judge summary, and human confirmation.

Core principle: discuss and approve the requirement direction before implementation starts.

## Flow

1. Extract the requirement text after `/ponyrace`; if the request text is missing, ask the user for the requirement in one concise question.
2. Run the Ponyrace CLI discussion with `ponyrace ponyrace "<request>"`.
3. If the user gives a manifest path, pass it with `--manifest <path>` instead of appending it to the request text.
4. Preserve the important CLI output when reporting back:
   - pony discussion lines
   - visible thinking transcript
   - Judge summary
   - approval tally
   - detailed requirement
   - `Human confirmation: pending`
5. Stop after the discussion and ask for explicit human approval before implementation.

## Guardrails

- Do not reimplement voting in the skill.
- Do not bypass the CLI requirement discussion.
- Do not start worker implementation from this skill.
- Do not treat 3-of-4 approval as human approval; the human owner must still confirm.
- If `ponyrace` is unavailable and this is not the local Ponyrace repo, say the CLI is unavailable and ask the user how they want to run it.
