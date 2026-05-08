# Product Specs Index

ADHD.ai turns Linear issues into staged agent execution with planning, implementation, and verification loops.

## Current Specs

- [new-user-onboarding.md](new-user-onboarding.md)
- [NON_TECHNICAL_GUIDE.md](../NON_TECHNICAL_GUIDE.md)

## Product Workflow Summary

1. Operator creates or assigns work in Linear.
2. ADHD.ai fetches eligible issues by project routing rules.
3. Planning agent produces implementation strategy.
4. Implementation agent updates code and PR context.
5. Review/testing agent validates and returns structured pass/fail output.
6. Failures are fed back into implementation until done or blocked.
