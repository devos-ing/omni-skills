# Product Manager GetSuperpower

Use this workflow when an agent should act as a startup product manager: discover
the real user problem, write a PRD, and slice the work into delivery-ready
issues.

Install it from the repo root:

```bash
bun run dev -- install examples/workflows/product-manager
```

Validate it while authoring:

```bash
bun run dev -- validate examples/workflows/product-manager
```

Refresh the checked skill fingerprints after editing the local role skill:

```bash
bun run dev -- lock examples/workflows/product-manager
```
