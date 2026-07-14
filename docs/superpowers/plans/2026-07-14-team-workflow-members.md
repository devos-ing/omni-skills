# Canonical Team Workflow Members Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove duplicated startup-team role skills by making team members resolve to canonical child workflow entry skills.

**Architecture:** Keep the team coordinator as one local entry skill, resolve every `members[]` source through the existing recursive workflow graph, and validate the selected child workflow's single local entry skill before installation. Migrate `startup-team` to `catalog:<role>` members, retain one root install record, and point landing links at the canonical standalone workflow sources.

**Tech Stack:** Bun, TypeScript, Commander, Zod, Bun test, Biome, Omniskills workflow manifests and schema `0.2` lock files.

**Execution rule:** Before each task's first file mutation, use `pony-trail` to record a pre-change snapshot for exactly that task's files. After its final mutation and focused checks, record the matching post-change snapshot before staging or committing.

---

## File Map

- `src/runtimes/omniskill/workflow-bundles.ts` — synchronous team manifest rules, recursive member resolution, and resolved-team validation.
- `src/omniskill.ts` — make `validate` run the same dependency graph validation as `deps`, `lock`, and `install`.
- `tests/workflow-bundles.test.ts` — public runtime-seam coverage for member workflows and failure modes.
- `tests/omniskill.test.ts` — CLI validation, pre-write failure, install artifact, and root-record coverage.
- `examples/teams/startup-team/workflow.json` — direct coordinator, child workflow members, and root-only steps.
- `examples/teams/startup-team/workflow.lock.json` — generated expanded child workflow graph and leaf fingerprints.
- `examples/teams/startup-team/skills/{ceo,cto,product-manager,web-design,engineering-manager,founding-engineer,qa-lead}/SKILL.md` — delete duplicated role definitions.
- `landing/lib/landing-content.ts` — canonical skill source URLs and startup-team local-skill ownership.
- `landing/components/workflow-detail.tsx` — use canonical skill links.
- `landing/app/workflows/[slug]/page.tsx` — use canonical skill links on static detail routes.
- `landing/components/workflow-run-demo.tsx` — link the coordinator to the team and roles to standalone workflows.
- `tests/landing-app.test.ts` — manifest/member parity and canonical source-link coverage.
- `AGENTS.md`, `docs/architecture.md`, `docs/workflow-author-guide.md` — authoritative team authoring contract.
- `tests/readme.test.ts` — repository-guidance contract coverage.

### Task 1: Validate Team Members Through the Recursive Workflow Graph

**Files:**
- Modify: `src/runtimes/omniskill/workflow-bundles.ts:77-150`
- Modify: `src/runtimes/omniskill/workflow-bundles.ts:717-890`
- Test: `tests/workflow-bundles.test.ts:430-560`
- Test: `tests/workflow-bundles.test.ts:1080-1215`

- [ ] **Step 1: Add a fixture helper for team and child workflow manifests**

Add this helper beside the existing workflow fixture helpers in `tests/workflow-bundles.test.ts`:

```ts
async function writeTeamWithMemberFixture(input: {
  rootDir: string;
  memberSource: string;
  childEntrySources?: Array<{ source: string; entry?: boolean }>;
}): Promise<{ teamDir: string; childDir: string }> {
  const teamDir = join(input.rootDir, "team");
  const childDir = join(input.rootDir, "child");
  await mkdir(join(teamDir, "skills", "coordinator"), { recursive: true });
  await writeFile(join(teamDir, "skills", "coordinator", "SKILL.md"), "# coordinator\n");
  await mkdir(join(childDir, "skills", "member"), { recursive: true });
  await writeFile(join(childDir, "skills", "member", "SKILL.md"), "# member\n");
  await writeFile(
    join(childDir, "workflow.json"),
    JSON.stringify({
      schemaVersion: "0.1",
      name: "member-workflow",
      version: "1.0.0",
      description: "Canonical member workflow.",
      skills: input.childEntrySources ?? [{ source: "./skills/member", entry: true }],
      steps: [{ id: "member", title: "Member", skill: "./skills/member" }],
    }),
  );
  await writeFile(
    join(teamDir, "workflow.json"),
    JSON.stringify({
      schemaVersion: "0.1",
      kind: "team",
      name: "test-team",
      version: "1.0.0",
      description: "Team with one canonical member workflow.",
      coordinator: "./skills/coordinator",
      members: [input.memberSource],
      skills: [
        { source: "./skills/coordinator", entry: true },
        { source: input.memberSource },
      ],
      steps: [
        { id: "coordinate", title: "Coordinate", skill: "./skills/coordinator" },
        { id: "member", title: "Member", skill: input.memberSource },
      ],
    }),
  );
  return { teamDir, childDir };
}
```

- [ ] **Step 2: Write the failing public-seam tests**

Add tests that call `resolveWorkflowDependencyGraph`, not private helpers:

```ts
test("resolves a team member to one canonical child workflow entry skill", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "team-member-workflow-"));
  try {
    const { teamDir } = await writeTeamWithMemberFixture({
      rootDir,
      memberSource: "../child",
    });
    const graph = await resolveWorkflowDependencyGraph({
      bundle: await loadWorkflowBundle(teamDir),
    });

    expect(graph.workflows.map(({ name }) => name)).toEqual(["test-team", "member-workflow"]);
    expect(graph.edges).toEqual([{ from: "test-team@1.0.0", to: "member-workflow@1.0.0" }]);
    expect(graph.dependencies.map(({ source }) => source)).toEqual([
      join(teamDir, "skills", "coordinator"),
      join(rootDir, "child", "skills", "member"),
    ]);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("rejects a copied local skill as a team member", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "team-local-member-"));
  try {
    const { teamDir } = await writeTeamWithMemberFixture({
      rootDir,
      memberSource: "./skills/copied-member",
    });
    await mkdir(join(teamDir, "skills", "copied-member"), { recursive: true });
    await writeFile(join(teamDir, "skills", "copied-member", "SKILL.md"), "# copied\n");

    await expect(
      resolveWorkflowDependencyGraph({ bundle: await loadWorkflowBundle(teamDir) }),
    ).rejects.toThrow(
      "Team member must reference a child workflow with exactly one local entry skill: ./skills/copied-member",
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
```

Add focused cases for zero entry, a non-local entry, duplicate resolved workflow names, duplicate entry names, and an existing cycle. A child manifest with multiple entries should assert the existing Zod error `Only one workflow skill can be marked as entry` while naming the member source in the wrapping resolution error.

Extend the existing repository/subdirectory, `catalog:`, and `installed:` resolver tests so each parent is a valid team with a local coordinator and the resolved child skill is marked `entry: true`. Together with the local `../child` case above, these tests prove every supported member source form.

Extend the existing highest-child-SemVer test so the root is a team whose member points to the lower version while another non-member dependency discovers the higher version of the same workflow. Mark each candidate's distinct local skill as its entry. Assert the selected member entry and flattened dependency come only from version `1.10.0`.

- [ ] **Step 3: Run the tests and verify the intended failures**

Run:

```bash
rtk bun test tests/workflow-bundles.test.ts -t "team member"
```

Expected: the canonical child case fails because non-local team members are rejected synchronously, and the copied local member case resolves as a leaf instead of failing the resolved-team rule.

- [ ] **Step 4: Relax only the synchronous member-path restriction**

In `WorkflowBundleManifestSchema.superRefine`, retain declaration, duplicate, and coordinator/member overlap checks, but remove this local-path rejection:

```ts
if (!isLocalWorkflowSkillSource(member)) {
  context.addIssue({
    code: z.ZodIssueCode.custom,
    message: `Team member must be a local skill path: ${member}`,
    path: ["members", index],
  });
}
```

Add a coordinator entry check after resolving `coordinatorSkill` from `manifest.skills`:

```ts
const coordinatorSkill = manifest.skills.find(
  (skill) => skill.source === manifest.coordinator,
);
if (coordinatorSkill && coordinatorSkill.entry !== true) {
  context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "Team coordinator must be marked as the entry skill",
    path: ["coordinator"],
  });
}
```

- [ ] **Step 5: Add one resolved-team validation module inside the runtime**

First wrap root-team member resolution errors at the `resolver.resolve` call inside `discover`. This preserves the child parser's original error while identifying which member source failed:

```ts
const memberSource =
  bundle === input.bundle && bundle.manifest.kind === "team"
    ? bundle.manifest.members?.find((source) => source === bundle.manifest.skills[index]?.source)
    : undefined;
let child: WorkflowBundle | null;
try {
  child = await resolver.resolve({ dependency, parent: bundle });
} catch (error) {
  if (!memberSource) throw error;
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`Failed to resolve team member ${memberSource}: ${message}`, { cause: error });
}
```

Then keep resolved-team validation private to `workflow-bundles.ts`:

```ts
function validateResolvedTeamMembers(input: {
  root: WorkflowBundle;
  resolvedChildren: Map<string, WorkflowBundle>;
  selectedByName: Map<string, WorkflowBundle>;
}): void {
  if (input.root.manifest.kind !== "team") return;

  const rootId = getCanonicalWorkflowIdentity(input.root);
  const workflowNames = new Set<string>();
  const entryNames = new Set<string>();

  for (const member of input.root.manifest.members ?? []) {
    const index = input.root.manifest.skills.findIndex((skill) => skill.source === member);
    const discovered = input.resolvedChildren.get(`${rootId}\n${index}`);
    const child = discovered
      ? (input.selectedByName.get(discovered.manifest.name) ?? discovered)
      : null;
    const entries = child?.manifest.skills.filter((skill) => skill.entry === true) ?? [];
    const entry = entries[0];
    if (!child || entries.length !== 1 || !entry || !isLocalWorkflowSkillSource(entry.source)) {
      throw new Error(
        `Team member must reference a child workflow with exactly one local entry skill: ${member}`,
      );
    }
    if (workflowNames.has(child.manifest.name)) {
      throw new Error(`Duplicate resolved team workflow: ${child.manifest.name}`);
    }
    const entryName = basename(entry.source);
    if (entryNames.has(entryName)) {
      throw new Error(`Duplicate resolved team entry skill: ${entryName}`);
    }
    workflowNames.add(child.manifest.name);
    entryNames.add(entryName);
  }
}
```

Call it immediately after discovery and before legacy/transitive lock validation:

```ts
validateResolvedTeamMembers({
  root: input.bundle,
  resolvedChildren,
  selectedByName,
});
```

Member indexes must continue to match the manifest skill order used by `resolvedChildren`.

- [ ] **Step 6: Run focused runtime tests**

Run:

```bash
rtk bun test tests/workflow-bundles.test.ts -t "team"
rtk bun run typecheck
```

Expected: all team tests pass and TypeScript reports no errors.

- [ ] **Step 7: Commit the runtime contract**

```bash
rtk git add src/runtimes/omniskill/workflow-bundles.ts tests/workflow-bundles.test.ts
rtk git commit -m "feat: resolve team members from child workflows"
```

### Task 2: Make Every CLI Command Enforce Resolved Team Validation

**Files:**
- Modify: `src/omniskill.ts:255-275`
- Modify: `tests/omniskill.test.ts:47-126`
- Test: `tests/omniskill.test.ts:930-1080`

- [ ] **Step 1: Migrate the CLI team fixture to a child workflow member**

When `options.team` is true in `writeGitWorkflowFixtureAt`, create
`member-workflow/skills/git-extra/SKILL.md` and its workflow manifest. The root
team uses `members: ["./member-workflow"]`, declares `./member-workflow` in
`skills[]`, and uses it in the member step. Keep `./skills/git-entry` as the
coordinator with `entry: true`.

Use this child manifest:

```ts
await writeFile(
  join(workflowDir, "member-workflow", "workflow.json"),
  JSON.stringify({
    schemaVersion: "0.1",
    name: "git-member",
    version: "1.0.0",
    description: "Canonical member workflow.",
    skills: [{ source: "./skills/git-extra", entry: true }],
    steps: [{ id: "member", title: "Member", skill: "./skills/git-extra" }],
  }),
);
```

- [ ] **Step 2: Write failing CLI tests for validate and pre-write install failure**

Add:

```ts
test("validate resolves team member workflows", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "omniskill-team-validate-"));
  const program = new Command();
  try {
    await writeGitWorkflowFixtureAt(rootDir, { team: true });
    configureOmniskillCommand(program, { rootDir });
    await expect(
      program.parseAsync(["validate", rootDir], { from: "user" }),
    ).resolves.toBeDefined();
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
```

Add a second fixture whose member is `./skills/git-extra`, call `install`, and
assert the fake `installSkill` call count is zero and no root workflow record
exists.

Use that same invalid fixture with fresh `Command` instances for `validate`, `deps`, and `lock`. Assert all three reject with `Team member must reference a child workflow`, matching `install`. For the valid fixture, assert install creates only `.omniskills/workflows/git-team.json`; it must not create a `git-member.json` child record.

- [ ] **Step 3: Run the CLI tests and verify validate is falsely green**

```bash
rtk bun test tests/omniskill.test.ts -t "team"
```

Expected: the invalid local-member `validate` case passes because the current validate command only loads the manifest.

- [ ] **Step 4: Resolve and clean up the graph in the validate command**

Replace the validate action body with this shape:

```ts
const bundle = await loadWorkflowBundle(path, {
  cwd: options.rootDir,
  ...(options.workflowGitCommandRunner
    ? { runGitCommand: options.workflowGitCommandRunner }
    : {}),
});
let graph: Awaited<ReturnType<typeof resolveWorkflowDependencyGraph>> | undefined;
try {
  graph = await resolveWorkflowDependencyGraph({
    bundle,
    ...(options.workflowGitCommandRunner
      ? { runGitCommand: options.workflowGitCommandRunner }
      : {}),
    installedRootDir: options.rootDir,
  });
  console.log(success(`Omniskills valid: ${bundle.manifest.name}@${bundle.manifest.version}`));
  console.log(keyValue("Steps", String(bundle.manifest.steps.length)));
  console.log(keyValue("Skills", String(graph.dependencies.length)));
} finally {
  await graph?.cleanup?.();
  await bundle.cleanup?.();
}
```

Use the existing inline load options rather than introducing a second command-specific adapter.

- [ ] **Step 5: Run focused CLI tests and typecheck**

```bash
rtk bun test tests/omniskill.test.ts -t "team"
rtk bun test tests/omniskill.test.ts -t "validate"
rtk bun run typecheck
```

Expected: validate, install ordering, coordinator next-step output, and cleanup tests pass.

- [ ] **Step 6: Commit the shared CLI validation path**

```bash
rtk git add src/omniskill.ts tests/omniskill.test.ts
rtk git commit -m "fix: validate resolved team members in every command"
```

### Task 3: Migrate Startup Team to Canonical Role Workflows

**Files:**
- Modify: `examples/teams/startup-team/workflow.json`
- Modify: `examples/teams/startup-team/workflow.lock.json`
- Delete: `examples/teams/startup-team/skills/ceo/SKILL.md`
- Delete: `examples/teams/startup-team/skills/cto/SKILL.md`
- Delete: `examples/teams/startup-team/skills/product-manager/SKILL.md`
- Delete: `examples/teams/startup-team/skills/web-design/SKILL.md`
- Delete: `examples/teams/startup-team/skills/engineering-manager/SKILL.md`
- Delete: `examples/teams/startup-team/skills/founding-engineer/SKILL.md`
- Delete: `examples/teams/startup-team/skills/qa-lead/SKILL.md`
- Test: `tests/workflow-bundles.test.ts:1080-1215`

- [ ] **Step 1: Rewrite the startup-team contract test first**

Change the expected members and role steps to:

```ts
const canonicalMembers = [
  "catalog:ceo",
  "catalog:cto",
  "catalog:product-manager",
  "catalog:web-design",
  "catalog:engineering-manager",
  "catalog:founding-engineer",
  "catalog:qa-lead",
];
expect(bundle.manifest.members).toEqual(canonicalMembers);
expect(bundle.manifest.steps.map((step) => [step.id, step.skill])).toEqual([
  ["requirements", "superpowers:brainstorming"],
  ["route", "./skills/startup-goal"],
  ["strategy", "catalog:ceo"],
  ["product", "catalog:product-manager"],
  ["design", "catalog:web-design"],
  ["technology", "catalog:cto"],
  ["delivery", "catalog:engineering-manager"],
  ["implementation", "catalog:founding-engineer"],
  ["implement", "mattpocock:implement"],
  ["qa", "catalog:qa-lead"],
]);
for (const role of canonicalMembers.map((source) => source.slice("catalog:".length))) {
  await expect(
    stat(join(import.meta.dir, "..", "examples", "teams", "startup-team", "skills", role)),
  ).rejects.toThrow();
}
```

Also assert that the expanded graph contains the root plus seven selected child
workflows and seven root edges, and that all seven canonical entry skill names
appear once in the leaf install plan.

- [ ] **Step 2: Run the startup-team test and verify it fails**

```bash
rtk bun test tests/workflow-bundles.test.ts -t "startup team"
```

Expected: members and steps still reference copied `./skills/<role>` paths.

- [ ] **Step 3: Replace direct role copies with child workflow sources**

Keep only these direct non-member skills in `workflow.json`:

```json
[
  { "source": "./skills/startup-goal", "entry": true },
  { "source": "catalog:ceo" },
  { "source": "catalog:cto" },
  { "source": "catalog:product-manager" },
  { "source": "catalog:web-design" },
  { "source": "catalog:engineering-manager" },
  { "source": "catalog:founding-engineer" },
  { "source": "catalog:qa-lead" },
  { "source": "superpowers:brainstorming", "repo": "obra/superpowers" },
  {
    "source": "mattpocock:implement",
    "repo": "https://github.com/mattpocock/skills/tree/v1.1.0"
  }
]
```

Update `members[]` and role `steps[].skill` to the matching `catalog:` values.

- [ ] **Step 4: Delete the duplicated role skill directories**

Delete only the seven paths listed in this task. Confirm the coordinator remains:

```bash
rtk rg --files examples/teams/startup-team/skills
```

Expected output: only `examples/teams/startup-team/skills/startup-goal/SKILL.md`.

- [ ] **Step 5: Regenerate and inspect the expanded lock**

```bash
rtk bun run dev -- lock examples/teams/startup-team
rtk bun run dev -- validate examples/teams/startup-team
rtk bun run dev -- deps examples/teams/startup-team
```

Expected: lock schema `0.2`, eight workflow nodes, seven root-to-member edges,
no deleted team-local role paths, and one leaf dependency per canonical entry
skill after deduplication.

- [ ] **Step 6: Run focused example tests**

```bash
rtk bun test tests/workflow-bundles.test.ts -t "startup team"
rtk bun test tests/workflow-bundles.test.ts -t "curated workflow examples"
rtk bun run typecheck
```

Expected: all commands pass.

- [ ] **Step 7: Commit the startup-team migration**

```bash
rtk git add examples/teams/startup-team tests/workflow-bundles.test.ts
rtk git commit -m "refactor: reuse canonical startup role workflows"
```

### Task 4: Point Landing and Documentation at Canonical Role Sources

**Files:**
- Modify: `landing/lib/landing-content.ts:12-55`
- Modify: `landing/lib/landing-content.ts:74-155`
- Modify: `landing/components/workflow-detail.tsx`
- Modify: `landing/app/workflows/[slug]/page.tsx`
- Modify: `landing/components/workflow-run-demo.tsx:80-115`
- Modify: `tests/landing-app.test.ts:250-300`
- Modify: `tests/landing-app.test.ts:540-565`
- Modify: `AGENTS.md`
- Modify: `docs/architecture.md:135-160`
- Modify: `docs/workflow-author-guide.md:390-425`
- Modify: `tests/readme.test.ts:90-115`

- [ ] **Step 1: Write failing landing source-link and manifest-parity tests**

Replace the flat roster assertion with contract assertions:

```ts
import { githubUrl, startupTeam } from "../landing/lib/landing-content";

const memberSkills = startupTeam.members.map(({ skill }) => skill);
expect(manifest.members).toEqual(memberSkills.map((skill) => `catalog:${skill}`));
expect(startupTeam.localSkillNames).toEqual(["startup-goal"]);
for (const skill of memberSkills) {
  expect(startupTeam.skillSourceUrls?.[skill]).toBe(
    `${githubUrl}/blob/main/examples/workflows/${skill}/skills/${skill}/SKILL.md`,
  );
}
```

Update the workflow-run-demo source test to require both canonical roots:

```ts
expect(demo).toContain("examples/teams/startup-team/skills/startup-goal/SKILL.md");
expect(demo).toContain("examples/workflows/${skill}/skills/${skill}/SKILL.md");
expect(demo).not.toContain("examples/teams/startup-team/skills/${skill}/SKILL.md");
```

- [ ] **Step 2: Run landing tests and verify links still target deleted files**

```bash
rtk bun test tests/landing-app.test.ts -t "startup-team"
rtk bun test tests/landing-app.test.ts -t "parallel startup-goal"
```

Expected: local skill ownership and canonical role URL assertions fail.

- [ ] **Step 3: Add explicit canonical skill URLs to landing content**

Add the optional URL map to `CatalogEntryBase` after `sourceUrl: string`, then replace the helper:

```ts
skillSourceUrls?: Record<string, string>;

export function getSkillSourceUrl(workflow: CatalogEntryContent, skill: string) {
  const explicitSource = workflow.skillSourceUrls?.[skill];
  if (explicitSource) return explicitSource;
  if (!workflow.localSkillNames.includes(skill)) return null;
  return `${workflow.sourceUrl.replace("/tree/", "/blob/")}/skills/${skill}/SKILL.md`;
}
```

Set `startupTeam.localSkillNames` to `["startup-goal"]` and add:

```ts
skillSourceUrls: {
  "startup-goal": `${githubUrl}/blob/main/examples/teams/startup-team/skills/startup-goal/SKILL.md`,
  ceo: `${githubUrl}/blob/main/examples/workflows/ceo/skills/ceo/SKILL.md`,
  cto: `${githubUrl}/blob/main/examples/workflows/cto/skills/cto/SKILL.md`,
  "product-manager": `${githubUrl}/blob/main/examples/workflows/product-manager/skills/product-manager/SKILL.md`,
  "web-design": `${githubUrl}/blob/main/examples/workflows/web-design/skills/web-design/SKILL.md`,
  "engineering-manager": `${githubUrl}/blob/main/examples/workflows/engineering-manager/skills/engineering-manager/SKILL.md`,
  "founding-engineer": `${githubUrl}/blob/main/examples/workflows/founding-engineer/skills/founding-engineer/SKILL.md`,
  "qa-lead": `${githubUrl}/blob/main/examples/workflows/qa-lead/skills/qa-lead/SKILL.md`,
},
```

Rename imports and calls from `getLocalSkillSourceUrl` to `getSkillSourceUrl` in both detail components.

- [ ] **Step 4: Split workflow-run-demo coordinator and role URL generation**

Replace the single team root with:

```ts
const STARTUP_TEAM_SOURCE_ROOT =
  "https://github.com/devos-ing/omni-skills/blob/main/examples/teams/startup-team";
const ROLE_WORKFLOW_SOURCE_ROOT =
  "https://github.com/devos-ing/omni-skills/blob/main/examples/workflows";

function skillSourceUrl(skill: SkillId) {
  return skill === "startup-goal"
    ? `${STARTUP_TEAM_SOURCE_ROOT}/skills/startup-goal/SKILL.md`
    : `${ROLE_WORKFLOW_SOURCE_ROOT}/${skill}/skills/${skill}/SKILL.md`;
}
```

- [ ] **Step 5: Update authoritative team guidance**

Change `AGENTS.md`, `docs/architecture.md`, and `docs/workflow-author-guide.md`
to state:

```md
A team coordinator is one declared local entry skill. Every `members[]` source
must be declared in `skills[]` and resolve to a child workflow with exactly one
local entry skill. Member workflow dependencies are expanded recursively; only
the root team install record is written.
```

Update `tests/readme.test.ts` to require `resolve to a child workflow` and to
reject the old phrase `unique local declared members`.

- [ ] **Step 6: Run landing and guidance tests**

```bash
rtk bun test tests/landing-app.test.ts
rtk bun test tests/landing-content-markdown.test.ts
rtk bun test tests/readme.test.ts
rtk bun run typecheck
```

Expected: all tests pass and canonical source URLs point to existing standalone role files.

- [ ] **Step 7: Commit landing and documentation parity**

```bash
rtk git add AGENTS.md docs/architecture.md docs/workflow-author-guide.md landing tests/landing-app.test.ts tests/readme.test.ts
rtk git commit -m "docs: link startup team to canonical role workflows"
```

### Task 5: Verify Clean Installation and Update the Existing PR

**Files:**
- Verify: all files changed by Tasks 1-4
- Generated smoke state: `work/team-workflow-members-smoke/`

- [ ] **Step 1: Run focused negative and install-order tests**

```bash
rtk bun test tests/workflow-bundles.test.ts -t "team member"
rtk bun test tests/omniskill.test.ts -t "team"
rtk bun test tests/omniskill.test.ts -t "before target writes"
```

Expected: invalid members fail, valid child members expand, and the installer is never called before graph validation succeeds.

- [ ] **Step 2: Run CLI smokes against the checked-in team**

```bash
rtk bun run dev -- validate examples/teams/startup-team
rtk bun run dev -- deps examples/teams/startup-team
rtk bun run dev -- lock examples/teams/startup-team
rtk git diff --exit-code -- examples/teams/startup-team/workflow.lock.json
```

Expected: validate and deps succeed; regenerating the lock produces no diff.

- [ ] **Step 3: Run a clean-home install smoke**

Use a new scratch directory that does not exist before this run:

```bash
rtk bun run dev -- install examples/teams/startup-team \
  --home work/team-workflow-members-smoke \
  --agents codex
rtk rg --files work/team-workflow-members-smoke/.omniskills/workflows
rtk rg --files work/team-workflow-members-smoke/.agents/skills
```

Expected: the workflow-record listing contains only `startup-team.json`; the
skill listing includes `startup-goal`, the seven canonical role entry skills,
and their deduplicated companions.

- [ ] **Step 4: Run the full repository gate**

```bash
rtk bun run check
```

Expected: Biome, TypeScript, all Bun tests, and the 90% line-coverage gate pass.

- [ ] **Step 5: Review the complete implementation against the design commit**

Use fixed point `0d63524`:

```bash
rtk git diff 0d63524...HEAD --stat
rtk git log 0d63524..HEAD --oneline
rtk git diff --check
```

Run the two-axis `mattpocock:code-review` workflow with:

- standards sources: `AGENTS.md`, `docs/architecture.md`, `biome.json`;
- spec source: `docs/superpowers/specs/2026-07-14-team-workflow-members-design.md`.

Address every actionable finding with a new red-green test and a focused fix commit. Rerun `rtk bun run check` after the final fix.

- [ ] **Step 6: Confirm branch and PR scope, then push**

```bash
rtk git status --short --branch
rtk git log origin/main..HEAD --oneline
rtk git push origin codex/recursive-workflow-skill-tree
rtk gh pr view 373 --repo devos-ing/omni-skills --json url,isDraft,headRefName,baseRefName,state
```

Expected: clean branch, PR `#373` remains open as a draft from
`codex/recursive-workflow-skill-tree` to `main`, and all implementation commits
are visible remotely.
