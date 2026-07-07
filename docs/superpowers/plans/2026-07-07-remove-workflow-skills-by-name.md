# Remove Workflow Skills By Name Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `getsuperpower remove <workflow-name>` and `getsuperpower workflow remove <workflow-name>` so users can remove skills installed by a named workflow without deleting shared artifacts.

**Architecture:** Keep command wiring in `src/getsuperpower.ts`, exact artifact knowledge in `src/plugins/skill-installer.ts`, and workflow record/removal planning in `src/runtimes/getsuperpower/workflow-bundles.ts`. Install records persist exact artifact paths; remove builds a plan from those paths, protects artifacts referenced by other workflow records, supports legacy inference, then deletes only safe paths and the named record.

**Tech Stack:** Bun tests, TypeScript, Commander, Zod, Node `fs/promises`, existing GetSuperpower runtime/plugin seams.

---

## File Structure

- Modify `src/plugins/skill-installer.ts`: expose `artifactPaths` on each target result so callers can persist mirrors such as `.codex/skills`.
- Modify `tests/skill-installer.test.ts`: cover primary plus mirror artifact paths for Codex and shared destinations.
- Modify `src/runtimes/getsuperpower/workflow-bundles.ts`: add installed-record schemas, install artifact types, load/remove planning helpers, legacy inference, and deletion execution.
- Modify `tests/workflow-bundles.test.ts`: cover install record metadata, remove planning, shared artifact protection, missing workflow errors, and legacy fallback.
- Modify `src/getsuperpower.ts`: collect install artifacts, pass them into `installWorkflowBundle`, configure root and compatibility remove commands, print remove plans, and prompt or accept `--yes`.
- Modify `tests/getsuperpower.test.ts`: cover command registration, install artifact metadata persistence through command flow, dry-run, confirmed remove, missing workflow, shared artifact preservation, and `workflow remove`.
- Modify `tests/cli.test.ts`: cover root command registration/help surface.
- Modify `docs/architecture.md`: document `remove` and the workflow install artifact metadata.
- Modify `openspec/changes/remove-workflow-skills-by-name/tasks.md`: mark implementation and verification tasks as they complete.

## Testing Seams

- `installAgentSkill()` is the public plugin seam for artifact path metadata.
- `installWorkflowBundle()`, `createWorkflowRemovalPlan()`, and `executeWorkflowRemovalPlan()` are the runtime seams for record behavior.
- `configureGetSuperpowerCommand()` is the command seam for root and compatibility remove behavior.
- `buildProgram()` is the top-level CLI seam for help and command registration.

### Task 1: Expose Installer Artifact Paths

**Files:**
- Modify: `src/plugins/skill-installer.ts`
- Test: `tests/skill-installer.test.ts`

- [ ] **Step 1: Write the failing artifact path test**

Add this assertion inside the existing `installs a bundled skill into Claude, Copilot/shared, Codex, Cursor, and opencode targets` test, after the status assertions:

```ts
      expect(result.targets).toEqual([
        expect.objectContaining({
          agent: "claude",
          destination: join(homeDir, ".claude", "skills", "pony-trail"),
          artifactPaths: [join(homeDir, ".claude", "skills", "pony-trail")],
          status: "installed",
        }),
        expect.objectContaining({
          agent: "copilot",
          destination: join(homeDir, ".agents", "skills", "pony-trail"),
          artifactPaths: [join(homeDir, ".agents", "skills", "pony-trail")],
          status: "installed",
        }),
        expect.objectContaining({
          agent: "codex",
          destination: join(homeDir, ".agents", "skills", "pony-trail"),
          artifactPaths: [
            join(homeDir, ".agents", "skills", "pony-trail"),
            join(homeDir, ".codex", "skills", "pony-trail"),
          ],
          status: "installed",
        }),
        expect.objectContaining({
          agent: "cursor",
          destination: join(homeDir, ".cursor", "rules", "pony-trail.mdc"),
          artifactPaths: [join(homeDir, ".cursor", "rules", "pony-trail.mdc")],
          status: "installed",
        }),
        expect.objectContaining({
          agent: "opencode",
          destination: join(homeDir, ".agents", "skills", "pony-trail"),
          artifactPaths: [join(homeDir, ".agents", "skills", "pony-trail")],
          status: "installed",
        }),
      ]);
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
rtk bun test tests/skill-installer.test.ts -t "installs a bundled skill into Claude"
```

Expected: FAIL because `artifactPaths` does not exist on target results.

- [ ] **Step 3: Implement artifact paths on target results**

In `src/plugins/skill-installer.ts`, update `SkillInstallTargetResult`:

```ts
export interface SkillInstallTargetResult {
  agent: SkillInstallAgent;
  destination: string;
  artifactPaths: string[];
  status: SkillInstallStatus;
}
```

Add this helper near `getSkillMirrorDestinations()`:

```ts
function getSkillArtifactPaths(
  homeDir: string,
  agent: SkillInstallAgent,
  skillName: string,
): string[] {
  const destination = getSkillDestination(homeDir, agent, skillName);
  return [destination, ...getSkillMirrorDestinations(homeDir, agent, skillName)];
}
```

Inside `installAgentSkill()`, after `const mirrorDestinations = ...`, add:

```ts
    const artifactPaths = [destination, ...mirrorDestinations];
```

Replace both `targets.push(...)` calls with:

```ts
      targets.push({ agent, destination, artifactPaths, status: handledStatus });
```

and:

```ts
    targets.push({ agent, destination, artifactPaths, status });
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run:

```bash
rtk bun test tests/skill-installer.test.ts -t "installs a bundled skill into Claude"
```

Expected: PASS.

- [ ] **Step 5: Run the installer suite**

Run:

```bash
rtk bun test tests/skill-installer.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add src/plugins/skill-installer.ts tests/skill-installer.test.ts
rtk git commit -m "feat: expose skill install artifact paths"
```

### Task 2: Persist Workflow Install Artifact Metadata

**Files:**
- Modify: `src/runtimes/getsuperpower/workflow-bundles.ts`
- Modify: `src/getsuperpower.ts`
- Test: `tests/workflow-bundles.test.ts`
- Test: `tests/getsuperpower.test.ts`

- [ ] **Step 1: Write the failing runtime record test**

In `tests/workflow-bundles.test.ts`, add this import:

```ts
  type WorkflowInstallSkillArtifact,
```

Add this test near the existing `installWorkflowBundle` record tests:

```ts
  test("stores workflow install artifact metadata in installed records", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-bundle-install-artifacts-"));
    const bundle = await loadWorkflowBundle("examples/workflows/release-review");
    const installArtifacts: WorkflowInstallSkillArtifact[] = [
      {
        source: "./skills/release-risk-review",
        skillName: "release-risk-review",
        agent: "codex",
        status: "installed",
        paths: [
          join(rootDir, ".agents", "skills", "release-risk-review"),
          join(rootDir, ".codex", "skills", "release-risk-review"),
        ],
      },
    ];

    try {
      const install = await installWorkflowBundle({ rootDir, bundle, installArtifacts });
      const installed = JSON.parse(await readFile(install.path, "utf8"));

      expect(installed.installArtifacts).toEqual(installArtifacts);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
```

- [ ] **Step 2: Run the focused runtime test to verify it fails**

Run:

```bash
rtk bun test tests/workflow-bundles.test.ts -t "stores workflow install artifact metadata"
```

Expected: FAIL because `WorkflowInstallSkillArtifact` and the new `installWorkflowBundle` input are not implemented.

- [ ] **Step 3: Add runtime artifact types and install record support**

In `src/runtimes/getsuperpower/workflow-bundles.ts`, add near `WorkflowSkillInstallDependency`:

```ts
export interface WorkflowInstallSkillArtifact {
  source: string;
  skillName: string;
  agent: string;
  status: string;
  paths: string[];
}
```

Change `InstalledWorkflowBundle`:

```ts
export interface InstalledWorkflowBundle extends WorkflowBundleManifest {
  source: WorkflowBundleSource;
  installArtifacts?: WorkflowInstallSkillArtifact[];
}
```

Change `installWorkflowBundle()` input:

```ts
export async function installWorkflowBundle(input: {
  rootDir: string;
  bundle: WorkflowBundle;
  installArtifacts?: WorkflowInstallSkillArtifact[];
}): Promise<WorkflowInstallResult> {
  const workflow = createInstalledWorkflowBundle(input.bundle, input.installArtifacts ?? []);
  const workflowDir = join(input.rootDir, workflowStoreDir);
  const path = join(workflowDir, `${workflow.name}.json`);

  await mkdir(workflowDir, { recursive: true });
  await writeFile(path, `${JSON.stringify(workflow, null, 2)}\n`);

  return { workflow, path };
}
```

Change `createInstalledWorkflowBundle()`:

```ts
function createInstalledWorkflowBundle(
  bundle: WorkflowBundle,
  installArtifacts: WorkflowInstallSkillArtifact[],
): InstalledWorkflowBundle {
  return {
    ...bundle.manifest,
    source: bundle.source,
    ...(installArtifacts.length > 0 ? { installArtifacts } : {}),
  };
}
```

- [ ] **Step 4: Run the focused runtime test to verify it passes**

Run:

```bash
rtk bun test tests/workflow-bundles.test.ts -t "stores workflow install artifact metadata"
```

Expected: PASS.

- [ ] **Step 5: Write the failing command-flow metadata test**

In `tests/getsuperpower.test.ts`, update `fakeSkillInstallResult()` so callers can pass artifact paths:

```ts
function fakeSkillInstallResult(input: {
  source: string;
  skillName: string;
  destination: string;
  artifactPaths?: string[];
}): SkillInstallResult {
  return {
    skillName: input.skillName,
    source: {
      kind: "path",
      name: input.skillName,
      path: input.source,
    },
    dryRun: false,
    targets: [
      {
        agent: "codex",
        destination: input.destination,
        artifactPaths: input.artifactPaths ?? [input.destination],
        status: "installed",
      },
    ],
    prehooks: [],
  };
}
```

Add this test after `install writes the workflow record to the global home by default`:

```ts
  test("install persists exact skill artifact paths in the workflow record", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-artifacts-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "getsuperpower-artifacts-home-"));
    const bundleDir = join(rootDir, "git-workflow");
    const program = new Command();
    const primary = join(homeDir, ".agents", "skills", "git-entry");
    const mirror = join(homeDir, ".codex", "skills", "git-entry");

    await writeGitWorkflowFixtureAt(bundleDir);

    configureGetSuperpowerCommand(program, {
      rootDir,
      installSkill: async (input) => ({
        skillInstall: fakeSkillInstallResult({
          source: input.source,
          skillName: "git-entry",
          destination: primary,
          artifactPaths: [primary, mirror],
        }),
      }),
      printSkillInstallResult: () => {},
    });

    await program.parseAsync(["install", bundleDir, "--home", homeDir, "--agents", "codex"], {
      from: "user",
    });

    const installed = JSON.parse(
      await readFile(join(homeDir, ".getsuperpower", "workflows", "git-workflow.json"), "utf8"),
    );

    expect(installed.installArtifacts).toEqual([
      {
        source: "./skills/git-entry",
        skillName: "git-entry",
        agent: "codex",
        status: "installed",
        paths: [primary, mirror],
      },
    ]);

    await rm(rootDir, { recursive: true, force: true });
    await rm(homeDir, { recursive: true, force: true });
  });
```

- [ ] **Step 6: Run the focused command-flow test to verify it fails**

Run:

```bash
rtk bun test tests/getsuperpower.test.ts -t "install persists exact skill artifact paths"
```

Expected: FAIL because `runGetSuperpowerInstall()` does not pass install artifacts into the workflow record.

- [ ] **Step 7: Collect and persist command-flow artifacts**

In `src/getsuperpower.ts`, import the runtime type:

```ts
  type WorkflowInstallSkillArtifact,
```

Inside `runGetSuperpowerInstall()`, before the install loop, add:

```ts
    const installArtifacts: WorkflowInstallSkillArtifact[] = [];
```

Inside the install loop, after `skillResult` is returned and before printing, add:

```ts
      const manifestSource = skillPlans[index]?.source ?? skillDependency.source;
      for (const target of skillResult.skillInstall.targets) {
        installArtifacts.push({
          source: manifestSource,
          skillName: skillResult.skillInstall.skillName,
          agent: target.agent,
          status: target.status,
          paths: target.artifactPaths,
        });
      }
```

Change the workflow record write:

```ts
    const install = await installWorkflowBundle({ rootDir: targetDir, bundle, installArtifacts });
```

- [ ] **Step 8: Run focused tests**

Run:

```bash
rtk bun test tests/workflow-bundles.test.ts -t "stores workflow install artifact metadata"
rtk bun test tests/getsuperpower.test.ts -t "install persists exact skill artifact paths"
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
rtk git add src/runtimes/getsuperpower/workflow-bundles.ts src/getsuperpower.ts tests/workflow-bundles.test.ts tests/getsuperpower.test.ts
rtk git commit -m "feat: record workflow install artifacts"
```

### Task 3: Add Workflow Removal Planning Helpers

**Files:**
- Modify: `src/runtimes/getsuperpower/workflow-bundles.ts`
- Test: `tests/workflow-bundles.test.ts`

- [ ] **Step 1: Write failing removal helper tests**

Add these imports in `tests/workflow-bundles.test.ts`:

```ts
  createWorkflowRemovalPlan,
  executeWorkflowRemovalPlan,
```

Add these tests near the install/list tests:

```ts
  test("plans removal from recorded workflow artifacts", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-remove-plan-"));
    const bundle = await loadWorkflowBundle("examples/workflows/release-review");
    const artifactPath = join(rootDir, ".agents", "skills", "release-risk-review");

    try {
      await installWorkflowBundle({
        rootDir,
        bundle,
        installArtifacts: [
          {
            source: "./skills/release-risk-review",
            skillName: "release-risk-review",
            agent: "codex",
            status: "installed",
            paths: [artifactPath],
          },
        ],
      });

      const plan = await createWorkflowRemovalPlan({
        rootDir,
        homeDir: rootDir,
        workflowName: "release-review",
      });

      expect(plan.workflow.name).toBe("release-review");
      expect(plan.legacy).toBe(false);
      expect(plan.artifactsToRemove.map((artifact) => artifact.path)).toEqual([artifactPath]);
      expect(plan.artifactsToKeep).toEqual([]);
      expect(plan.skippedArtifacts).toEqual([]);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("preserves artifacts referenced by another installed workflow", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-remove-shared-"));
    const releaseBundle = await loadWorkflowBundle("examples/workflows/release-review");
    const sharedPath = join(rootDir, ".agents", "skills", "pony-trail");
    const otherBundle = {
      ...releaseBundle,
      manifest: { ...releaseBundle.manifest, name: "ops-review" },
    };

    try {
      await installWorkflowBundle({
        rootDir,
        bundle: releaseBundle,
        installArtifacts: [
          {
            source: "pony-trail",
            skillName: "pony-trail",
            agent: "codex",
            status: "installed",
            paths: [sharedPath],
          },
        ],
      });
      await installWorkflowBundle({
        rootDir,
        bundle: otherBundle,
        installArtifacts: [
          {
            source: "pony-trail",
            skillName: "pony-trail",
            agent: "codex",
            status: "installed",
            paths: [sharedPath],
          },
        ],
      });

      const plan = await createWorkflowRemovalPlan({
        rootDir,
        homeDir: rootDir,
        workflowName: "release-review",
      });

      expect(plan.artifactsToRemove).toEqual([]);
      expect(plan.artifactsToKeep).toEqual([
        expect.objectContaining({ path: sharedPath, usedByWorkflows: ["ops-review"] }),
      ]);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("fails clearly when removing a workflow that is not installed", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-remove-missing-"));

    try {
      await expect(
        createWorkflowRemovalPlan({
          rootDir,
          homeDir: rootDir,
          workflowName: "missing-workflow",
        }),
      ).rejects.toThrow("GetSuperpower is not installed: missing-workflow");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("executes a removal plan by deleting artifacts and the workflow record", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-remove-execute-"));
    const bundle = await loadWorkflowBundle("examples/workflows/release-review");
    const artifactPath = join(rootDir, ".agents", "skills", "release-risk-review");

    try {
      await mkdir(artifactPath, { recursive: true });
      await writeFile(join(artifactPath, "SKILL.md"), "installed skill");
      const install = await installWorkflowBundle({
        rootDir,
        bundle,
        installArtifacts: [
          {
            source: "./skills/release-risk-review",
            skillName: "release-risk-review",
            agent: "codex",
            status: "installed",
            paths: [artifactPath],
          },
        ],
      });

      const plan = await createWorkflowRemovalPlan({
        rootDir,
        homeDir: rootDir,
        workflowName: "release-review",
      });
      await executeWorkflowRemovalPlan(plan);

      await expect(stat(artifactPath)).rejects.toThrow();
      await expect(stat(install.path)).rejects.toThrow();
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
```

- [ ] **Step 2: Run focused tests to verify they fail**

Run:

```bash
rtk bun test tests/workflow-bundles.test.ts -t "removal"
```

Expected: FAIL because the removal helper exports do not exist.

- [ ] **Step 3: Implement record path, load, plan, and execute helpers**

In `src/runtimes/getsuperpower/workflow-bundles.ts`, add these interfaces near the install artifact type:

```ts
export interface WorkflowRemovalArtifact {
  source: string;
  skillName: string;
  agent: string;
  status: string;
  path: string;
}

export interface WorkflowRemovalKeptArtifact extends WorkflowRemovalArtifact {
  usedByWorkflows: string[];
}

export interface WorkflowRemovalSkippedArtifact {
  source: string;
  reason: string;
}

export interface WorkflowRemovalPlan {
  workflow: InstalledWorkflowBundle;
  workflowRecordPath: string;
  legacy: boolean;
  artifactsToRemove: WorkflowRemovalArtifact[];
  artifactsToKeep: WorkflowRemovalKeptArtifact[];
  skippedArtifacts: WorkflowRemovalSkippedArtifact[];
}
```

Add these helpers after `listInstalledWorkflowBundles()`:

```ts
export function getInstalledWorkflowBundlePath(input: {
  rootDir: string;
  workflowName: string;
}): string {
  return join(input.rootDir, workflowStoreDir, `${input.workflowName}.json`);
}

export async function loadInstalledWorkflowBundle(input: {
  rootDir: string;
  workflowName: string;
}): Promise<{ workflow: InstalledWorkflowBundle; path: string }> {
  const path = getInstalledWorkflowBundlePath(input);
  try {
    const raw = await readFile(path, "utf8");
    return { workflow: JSON.parse(raw) as InstalledWorkflowBundle, path };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`GetSuperpower is not installed: ${input.workflowName}`);
    }
    throw error;
  }
}

export async function createWorkflowRemovalPlan(input: {
  rootDir: string;
  homeDir: string;
  workflowName: string;
}): Promise<WorkflowRemovalPlan> {
  const installed = await loadInstalledWorkflowBundle({
    rootDir: input.rootDir,
    workflowName: input.workflowName,
  });
  const otherWorkflows = (await listInstalledWorkflowBundles({ rootDir: input.rootDir })).filter(
    (workflow) => workflow.name !== input.workflowName,
  );
  const legacy = !installed.workflow.installArtifacts?.length;
  const skippedArtifacts: WorkflowRemovalSkippedArtifact[] = [];
  const candidates = legacy
    ? inferLegacyRemovalArtifacts(installed.workflow, input.homeDir, skippedArtifacts)
    : flattenInstallArtifacts(installed.workflow.installArtifacts ?? []);
  const otherPathOwners = getArtifactPathOwners(otherWorkflows);
  const artifactsToRemove: WorkflowRemovalArtifact[] = [];
  const artifactsToKeep: WorkflowRemovalKeptArtifact[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (seen.has(candidate.path)) {
      continue;
    }
    seen.add(candidate.path);
    const usedByWorkflows = otherPathOwners.get(candidate.path) ?? [];
    if (usedByWorkflows.length > 0) {
      artifactsToKeep.push({ ...candidate, usedByWorkflows });
      continue;
    }
    artifactsToRemove.push(candidate);
  }

  return {
    workflow: installed.workflow,
    workflowRecordPath: installed.path,
    legacy,
    artifactsToRemove,
    artifactsToKeep,
    skippedArtifacts,
  };
}

export async function executeWorkflowRemovalPlan(plan: WorkflowRemovalPlan): Promise<void> {
  for (const artifact of plan.artifactsToRemove) {
    await rm(artifact.path, { recursive: true, force: true });
  }
  await rm(plan.workflowRecordPath, { force: true });
}
```

Add the helper functions used above:

```ts
function flattenInstallArtifacts(
  artifacts: WorkflowInstallSkillArtifact[],
): WorkflowRemovalArtifact[] {
  return artifacts.flatMap((artifact) =>
    isRemovableInstallStatus(artifact.status)
      ? artifact.paths.map((path) => ({
          source: artifact.source,
          skillName: artifact.skillName,
          agent: artifact.agent,
          status: artifact.status,
          path,
        }))
      : [],
  );
}

function isRemovableInstallStatus(status: string): boolean {
  return status === "installed" || status === "updated" || status === "overwritten";
}

function getArtifactPathOwners(workflows: InstalledWorkflowBundle[]): Map<string, string[]> {
  const owners = new Map<string, string[]>();
  for (const workflow of workflows) {
    for (const artifact of workflow.installArtifacts ?? []) {
      for (const path of artifact.paths) {
        const existing = owners.get(path) ?? [];
        existing.push(workflow.name);
        owners.set(path, existing);
      }
    }
  }
  return owners;
}
```

- [ ] **Step 4: Add legacy inference helpers**

In the same file, add:

```ts
function inferLegacyRemovalArtifacts(
  workflow: InstalledWorkflowBundle,
  homeDir: string,
  skippedArtifacts: WorkflowRemovalSkippedArtifact[],
): WorkflowRemovalArtifact[] {
  const artifacts: WorkflowRemovalArtifact[] = [];
  for (const skill of workflow.skills) {
    const inferred = inferLegacySkillName(skill.source);
    if (!inferred.skillName) {
      skippedArtifacts.push({ source: skill.source, reason: inferred.reason });
      continue;
    }
    for (const path of getLegacySkillArtifactPaths(homeDir, inferred.skillName)) {
      artifacts.push({
        source: skill.source,
        skillName: inferred.skillName,
        agent: "legacy",
        status: "legacy_inferred",
        path,
      });
    }
  }
  return artifacts;
}

function inferLegacySkillName(source: string): { skillName: string } | { reason: string } {
  if (isLocalWorkflowSkillSource(source)) {
    const skillName = basename(source);
    return skillName ? { skillName } : { reason: "Local skill source has no folder name" };
  }
  if (source === "superpowers:brainstorming") {
    return { skillName: "superpowers-brainstorming" };
  }
  if (source === "superpowers:writing-plans") {
    return { skillName: "superpowers-writing-plans" };
  }
  if (source.startsWith("mattpocock:")) {
    const skillName = source.slice("mattpocock:".length).trim();
    return skillName ? { skillName } : { reason: "Matt Pocock skill source has no skill name" };
  }
  if (source.startsWith("github:mattpocock/skills/")) {
    const suffix = source.slice("github:mattpocock/skills/".length);
    const skillName = suffix.startsWith("skills/") ? suffix.slice("skills/".length) : suffix;
    return skillName ? { skillName } : { reason: "Matt Pocock GitHub source has no skill name" };
  }
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source)) {
    return { skillName: source };
  }
  return { reason: `Cannot safely infer installed skill name from ${source}` };
}

function getLegacySkillArtifactPaths(homeDir: string, skillName: string): string[] {
  return [
    join(homeDir, ".claude", "skills", skillName),
    join(homeDir, ".agents", "skills", skillName),
    join(homeDir, ".codex", "skills", skillName),
    join(homeDir, ".cursor", "rules", `${skillName}.mdc`),
  ];
}
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
rtk bun test tests/workflow-bundles.test.ts -t "removal"
```

Expected: PASS.

- [ ] **Step 6: Add focused legacy tests**

Add this test:

```ts
  test("infers legacy removal artifacts and skips unmappable legacy sources", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-remove-legacy-"));
    const workflowDir = join(rootDir, ".getsuperpower", "workflows");

    try {
      await mkdir(workflowDir, { recursive: true });
      await writeFile(
        join(workflowDir, "legacy-workflow.json"),
        JSON.stringify(
          {
            schemaVersion: "0.1",
            name: "legacy-workflow",
            version: "0.1.0",
            description: "Legacy workflow record.",
            source: { kind: "local", path: "/tmp/legacy-workflow" },
            skills: [
              { source: "./skills/local-review" },
              { source: "superpowers:brainstorming" },
              { source: "https://example.com/unknown.git#skills/custom" },
            ],
            steps: [
              { id: "local", title: "Local", skill: "./skills/local-review" },
              { id: "shape", title: "Shape", skill: "superpowers:brainstorming" },
            ],
          },
          null,
          2,
        ),
      );

      const plan = await createWorkflowRemovalPlan({
        rootDir,
        homeDir: rootDir,
        workflowName: "legacy-workflow",
      });

      expect(plan.legacy).toBe(true);
      expect(plan.artifactsToRemove.map((artifact) => artifact.path)).toContain(
        join(rootDir, ".agents", "skills", "local-review"),
      );
      expect(plan.artifactsToRemove.map((artifact) => artifact.path)).toContain(
        join(rootDir, ".agents", "skills", "superpowers-brainstorming"),
      );
      expect(plan.skippedArtifacts).toEqual([
        {
          source: "https://example.com/unknown.git#skills/custom",
          reason:
            "Cannot safely infer installed skill name from https://example.com/unknown.git#skills/custom",
        },
      ]);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
```

Run:

```bash
rtk bun test tests/workflow-bundles.test.ts -t "legacy removal"
```

Expected: PASS.

- [ ] **Step 7: Run the runtime suite**

Run:

```bash
rtk bun test tests/workflow-bundles.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
rtk git add src/runtimes/getsuperpower/workflow-bundles.ts tests/workflow-bundles.test.ts
rtk git commit -m "feat: plan workflow skill removal"
```

### Task 4: Wire Root And Compatibility Remove Commands

**Files:**
- Modify: `src/getsuperpower.ts`
- Modify: `tests/getsuperpower.test.ts`
- Modify: `tests/cli.test.ts`

- [ ] **Step 1: Write failing command registration tests**

In `tests/getsuperpower.test.ts`, update the registration expectation:

```ts
    expect(program.commands.map((command) => command.name())).toEqual([
      "init",
      "validate",
      "install",
      "list",
      "remove",
      "deps",
      "onboard",
      "loop",
      "bundle",
      "workflow",
    ]);
```

Add:

```ts
    expect(
      program.commands
        .find((command) => command.name() === "workflow")
        ?.commands.map((command) => command.name()),
    ).toEqual(["install", "list", "remove"]);
```

In `tests/cli.test.ts`, update the root registration expectation:

```ts
    expect(program.commands.map((command) => command.name())).toEqual([
      "init",
      "validate",
      "install",
      "list",
      "remove",
      "deps",
      "onboard",
      "loop",
      "bundle",
      "workflow",
      "skills",
    ]);
```

Update the workflow command expectation:

```ts
    expect(workflowCommand?.commands.map((command) => command.name())).toEqual([
      "install",
      "list",
      "remove",
    ]);
```

- [ ] **Step 2: Run registration tests to verify they fail**

Run:

```bash
rtk bun test tests/getsuperpower.test.ts -t "registers GetSuperpower commands"
rtk bun test tests/cli.test.ts -t "registers GetSuperpower and skill commands only"
```

Expected: FAIL because remove commands are not registered.

- [ ] **Step 3: Add remove command types and options**

In `src/getsuperpower.ts`, add imports:

```ts
  createWorkflowRemovalPlan,
  executeWorkflowRemovalPlan,
  type WorkflowRemovalPlan,
```

Add options and prompt interfaces near install options:

```ts
interface GetSuperpowerRemoveCommandOptions {
  dir?: string;
  home: string;
  dryRun: boolean;
  yes: boolean;
}

export interface GetSuperpowerRemovePromptInput {
  workflowName: string;
  artifactsToRemove: number;
  artifactsToKeep: number;
}

export interface GetSuperpowerRemovePrompt {
  confirmRemove(input: GetSuperpowerRemovePromptInput): Promise<boolean>;
}
```

Add `removePrompt?: GetSuperpowerRemovePrompt;` to `ConfigureGetSuperpowerCommandOptions`.

- [ ] **Step 4: Configure root and workflow remove commands**

In `configureGetSuperpowerCommands()`, add `configureRemoveCommand(command, options);` after list.

In `configureGetSuperpowerCommand()`, add `configureRemoveCommand(workflowCommand, options);` after list.

Add this function near `configureListCommand()`:

```ts
function configureRemoveCommand(
  command: Command,
  options: ConfigureGetSuperpowerCommandOptions,
): void {
  command
    .command("remove")
    .description("Remove an installed GetSuperpower and its recorded skill artifacts.")
    .argument("<workflow-name>", "installed GetSuperpower workflow name")
    .option("--dir <dir>", "override directory with .getsuperpower/workflows")
    .option("--home <dir>", "home directory with global GetSuperpower records", homedir())
    .option("--dry-run", "print the removal plan without deleting files", false)
    .option("--yes", "remove without prompting for confirmation", false)
    .action((workflowName: string, commandOptions: GetSuperpowerRemoveCommandOptions) =>
      runGetSuperpowerRemove(workflowName, commandOptions, options),
    );
}
```

Add `runGetSuperpowerRemove()` with the full planned command flow:

```ts
async function runGetSuperpowerRemove(
  workflowName: string,
  commandOptions: GetSuperpowerRemoveCommandOptions,
  options: ConfigureGetSuperpowerCommandOptions,
): Promise<void> {
  const homeDir = resolveHomePath(commandOptions.home);
  const targetDir = commandOptions.dir ? resolvePath(options.rootDir, commandOptions.dir) : homeDir;
  const plan = await createWorkflowRemovalPlan({
    rootDir: targetDir,
    homeDir,
    workflowName,
  });
  printGetSuperpowerRemovePlan(plan, commandOptions.dryRun);

  if (commandOptions.dryRun) {
    return;
  }

  const prompt = options.removePrompt ?? createDefaultRemovePrompt();
  const approved =
    commandOptions.yes ||
    (await prompt.confirmRemove({
      workflowName,
      artifactsToRemove: plan.artifactsToRemove.length,
      artifactsToKeep: plan.artifactsToKeep.length,
    }));
  if (!approved) {
    console.log(warning("GetSuperpower remove cancelled."));
    return;
  }

  await executeWorkflowRemovalPlan(plan);
  console.log(success(`GetSuperpower removed: ${workflowName}`));
}
```

- [ ] **Step 5: Add remove plan printing and default prompt**

Add:

```ts
function printGetSuperpowerRemovePlan(plan: WorkflowRemovalPlan, dryRun: boolean): void {
  console.log(success(`GetSuperpower remove plan: ${plan.workflow.name}`));
  console.log(keyValue("Workflow record", plan.workflowRecordPath));
  if (plan.legacy) {
    console.log(warning("Legacy workflow record detected; removal paths are inferred."));
  }

  const removeHeading = dryRun ? "Artifacts that would be removed:" : "Artifacts to remove:";
  console.log(removeHeading);
  if (plan.artifactsToRemove.length === 0) {
    console.log("- none");
  } else {
    for (const artifact of plan.artifactsToRemove) {
      console.log(`- ${artifact.path}`);
    }
  }

  if (plan.artifactsToKeep.length > 0) {
    console.log("Artifacts kept:");
    for (const artifact of plan.artifactsToKeep) {
      console.log(`- ${artifact.path} (still used by ${artifact.usedByWorkflows.join(", ")})`);
    }
  }

  if (plan.skippedArtifacts.length > 0) {
    console.log("Skipped artifacts:");
    for (const artifact of plan.skippedArtifacts) {
      console.log(`- ${artifact.source}: ${artifact.reason}`);
    }
  }
}

function createDefaultRemovePrompt(): GetSuperpowerRemovePrompt {
  return {
    confirmRemove: async (input) => {
      if (!process.stdin.isTTY) {
        console.log(muted("Non-interactive shell detected; pass --yes to remove."));
        return false;
      }

      const result = await clackConfirm({
        message: `Remove ${input.workflowName} and ${input.artifactsToRemove} skill artifacts?`,
        initialValue: false,
      });

      if (isCancel(result)) {
        clackCancel("GetSuperpower remove cancelled");
        return false;
      }

      return result;
    },
  };
}
```

- [ ] **Step 6: Run registration tests**

Run:

```bash
rtk bun test tests/getsuperpower.test.ts -t "registers GetSuperpower commands"
rtk bun test tests/cli.test.ts -t "registers GetSuperpower and skill commands only"
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
rtk git add src/getsuperpower.ts tests/getsuperpower.test.ts tests/cli.test.ts
rtk git commit -m "feat: register workflow remove commands"
```

### Task 5: Cover Remove Command Behavior

**Files:**
- Modify: `tests/getsuperpower.test.ts`
- Modify: `src/getsuperpower.ts` if behavior needs adjustment

- [ ] **Step 1: Write dry-run and confirmed remove tests**

Add these tests in `tests/getsuperpower.test.ts` near install/list behavior:

```ts
  test("remove dry-run prints the plan without deleting artifacts or workflow record", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-remove-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "getsuperpower-remove-home-"));
    const bundleDir = join(rootDir, "git-workflow");
    const artifactPath = join(homeDir, ".agents", "skills", "git-entry");
    const logs: string[] = [];
    const originalLog = console.log;
    const program = new Command();

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeGitWorkflowFixtureAt(bundleDir);
      await mkdir(artifactPath, { recursive: true });
      await writeFile(join(artifactPath, "SKILL.md"), "installed skill");

      configureGetSuperpowerCommand(program, {
        rootDir,
        installSkill: async (input) => ({
          skillInstall: fakeSkillInstallResult({
            source: input.source,
            skillName: "git-entry",
            destination: artifactPath,
            artifactPaths: [artifactPath],
          }),
        }),
        printSkillInstallResult: () => {},
      });

      await program.parseAsync(["install", bundleDir, "--home", homeDir, "--agents", "codex"], {
        from: "user",
      });
      await program.parseAsync(["remove", "git-workflow", "--home", homeDir, "--dry-run"], {
        from: "user",
      });

      expect(stripAnsiLines(logs).join("\n")).toContain("GetSuperpower remove plan: git-workflow");
      expect(stripAnsiLines(logs).join("\n")).toContain("Artifacts that would be removed:");
      await expect(stat(artifactPath)).resolves.toBeTruthy();
      await expect(
        stat(join(homeDir, ".getsuperpower", "workflows", "git-workflow.json")),
      ).resolves.toBeTruthy();
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("remove confirmed with yes deletes artifacts and workflow record", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-remove-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "getsuperpower-remove-home-"));
    const bundleDir = join(rootDir, "git-workflow");
    const artifactPath = join(homeDir, ".agents", "skills", "git-entry");
    const logs: string[] = [];
    const originalLog = console.log;
    const program = new Command();

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeGitWorkflowFixtureAt(bundleDir);
      await mkdir(artifactPath, { recursive: true });
      await writeFile(join(artifactPath, "SKILL.md"), "installed skill");

      configureGetSuperpowerCommand(program, {
        rootDir,
        installSkill: async (input) => ({
          skillInstall: fakeSkillInstallResult({
            source: input.source,
            skillName: "git-entry",
            destination: artifactPath,
            artifactPaths: [artifactPath],
          }),
        }),
        printSkillInstallResult: () => {},
      });

      await program.parseAsync(["install", bundleDir, "--home", homeDir, "--agents", "codex"], {
        from: "user",
      });
      await program.parseAsync(["remove", "git-workflow", "--home", homeDir, "--yes"], {
        from: "user",
      });

      expect(stripAnsiLines(logs)).toContain("GetSuperpower removed: git-workflow");
      await expect(stat(artifactPath)).rejects.toThrow();
      await expect(
        stat(join(homeDir, ".getsuperpower", "workflows", "git-workflow.json")),
      ).rejects.toThrow();
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });
```

- [ ] **Step 2: Write compatibility, missing, shared, and prompt tests**

Add:

```ts
  test("workflow remove behaves like root remove", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-workflow-remove-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "getsuperpower-workflow-remove-home-"));
    const bundleDir = join(rootDir, "git-workflow");
    const artifactPath = join(homeDir, ".agents", "skills", "git-entry");
    const program = new Command();

    try {
      await writeGitWorkflowFixtureAt(bundleDir);
      await mkdir(artifactPath, { recursive: true });
      await writeFile(join(artifactPath, "SKILL.md"), "installed skill");

      configureGetSuperpowerCommand(program, {
        rootDir,
        installSkill: async (input) => ({
          skillInstall: fakeSkillInstallResult({
            source: input.source,
            skillName: "git-entry",
            destination: artifactPath,
            artifactPaths: [artifactPath],
          }),
        }),
        printSkillInstallResult: () => {},
      });

      await program.parseAsync(["install", bundleDir, "--home", homeDir, "--agents", "codex"], {
        from: "user",
      });
      await program.parseAsync(["workflow", "remove", "git-workflow", "--home", homeDir, "--yes"], {
        from: "user",
      });

      await expect(stat(artifactPath)).rejects.toThrow();
    } finally {
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("remove fails clearly when the workflow is not installed", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-remove-missing-"));
    const homeDir = await mkdtemp(join(tmpdir(), "getsuperpower-remove-missing-home-"));
    const program = new Command();

    try {
      configureGetSuperpowerCommand(program, {
        rootDir,
        installSkill: async () => {
          throw new Error("install is not exercised by remove missing");
        },
        printSkillInstallResult: () => {},
      });

      await expect(
        program.parseAsync(["remove", "missing-workflow", "--home", homeDir], { from: "user" }),
      ).rejects.toThrow("GetSuperpower is not installed: missing-workflow");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("remove keeps artifacts still referenced by another workflow", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-remove-shared-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "getsuperpower-remove-shared-home-"));
    const firstBundleDir = join(rootDir, "git-workflow");
    const secondBundleDir = join(rootDir, "ops-workflow");
    const artifactPath = join(homeDir, ".agents", "skills", "git-entry");
    const logs: string[] = [];
    const originalLog = console.log;
    const program = new Command();

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeGitWorkflowFixtureAt(firstBundleDir);
      await writeGitWorkflowFixtureAt(secondBundleDir);
      const secondRecord = JSON.parse(await readFile(join(secondBundleDir, "workflow.json"), "utf8"));
      secondRecord.name = "ops-workflow";
      await writeFile(join(secondBundleDir, "workflow.json"), `${JSON.stringify(secondRecord, null, 2)}\n`);
      await mkdir(artifactPath, { recursive: true });
      await writeFile(join(artifactPath, "SKILL.md"), "installed skill");

      configureGetSuperpowerCommand(program, {
        rootDir,
        installSkill: async (input) => ({
          skillInstall: fakeSkillInstallResult({
            source: input.source,
            skillName: "git-entry",
            destination: artifactPath,
            artifactPaths: [artifactPath],
          }),
        }),
        printSkillInstallResult: () => {},
      });

      await program.parseAsync(["install", firstBundleDir, "--home", homeDir, "--agents", "codex"], {
        from: "user",
      });
      await program.parseAsync(["install", secondBundleDir, "--home", homeDir, "--agents", "codex"], {
        from: "user",
      });
      await program.parseAsync(["remove", "git-workflow", "--home", homeDir, "--yes"], {
        from: "user",
      });

      expect(stripAnsiLines(logs).join("\n")).toContain(
        `${artifactPath} (still used by ops-workflow)`,
      );
      await expect(stat(artifactPath)).resolves.toBeTruthy();
      await expect(
        stat(join(homeDir, ".getsuperpower", "workflows", "git-workflow.json")),
      ).rejects.toThrow();
      await expect(
        stat(join(homeDir, ".getsuperpower", "workflows", "ops-workflow.json")),
      ).resolves.toBeTruthy();
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });
```

- [ ] **Step 3: Run behavior tests**

Run:

```bash
rtk bun test tests/getsuperpower.test.ts -t "remove"
```

Expected: PASS after small output or prompt adjustments.

- [ ] **Step 4: Run GetSuperpower command tests**

Run:

```bash
rtk bun test tests/getsuperpower.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/getsuperpower.ts tests/getsuperpower.test.ts
rtk git commit -m "feat: remove workflow-installed skills"
```

### Task 6: Update Docs, OpenSpec Checklist, And Smoke

**Files:**
- Modify: `docs/architecture.md`
- Modify: `openspec/changes/remove-workflow-skills-by-name/tasks.md`
- Test: CLI smoke under `work/remove-workflow-skills-smoke/`

- [ ] **Step 1: Update architecture docs**

In `docs/architecture.md`, add `getsuperpower remove <workflow-name>` to Primary commands:

```md
- `getsuperpower remove <workflow-name>`
```

Add `workflow remove` under Compatibility aliases:

```md
- `workflow remove`
```

In the GetSuperpower Runtime section, update the record bullet:

```md
- install normalized global records under `~/.getsuperpower/workflows/` with
  exact skill artifact metadata for later removal
- plan and execute removal of installed workflow skill artifacts while
  preserving artifacts referenced by other workflow records
```

- [ ] **Step 2: Run docs-adjacent checks**

Run:

```bash
rtk bun test tests/cli.test.ts
rtk openspec validate remove-workflow-skills-by-name --strict
```

Expected: PASS.

- [ ] **Step 3: Run a scratch-home smoke check**

Run:

```bash
rtk mkdir -p work/remove-workflow-skills-smoke
rtk bun run dev -- install examples/workflows/release-review --home work/remove-workflow-skills-smoke/home --agents codex
rtk bun run dev -- remove release-review --home work/remove-workflow-skills-smoke/home --dry-run
rtk bun run dev -- remove release-review --home work/remove-workflow-skills-smoke/home --yes
rtk bun run dev -- list --home work/remove-workflow-skills-smoke/home
```

Expected:

- install succeeds and writes `work/remove-workflow-skills-smoke/home/.getsuperpower/workflows/release-review.json`;
- dry-run prints artifacts that would be removed;
- confirmed remove deletes the workflow record;
- list prints `No GetSuperpowers installed.`;
- the command does not write to the real home directory.

- [ ] **Step 4: Run the full gate**

Run:

```bash
rtk bun run check
```

Expected: PASS.

- [ ] **Step 5: Update OpenSpec task checklist**

In `openspec/changes/remove-workflow-skills-by-name/tasks.md`, mark completed implementation and verification items:

```md
## 3. Plan Implementation

- [x] Write the implementation plan in `docs/superpowers/plans/`.
- [x] Include TDD slices for command registration, workflow-record metadata,
      dry-run output, shared-artifact protection, legacy fallback behavior, and
      scratch-home smoke checks.

## 4. Implement With TDD

- [x] Add failing registration tests for `remove` and `workflow remove`.
- [x] Add failing workflow-runtime tests for reading, planning, and deleting a
      named installed workflow record.
- [x] Add failing install tests proving workflow records capture exact skill
      artifact metadata.
- [x] Add failing CLI tests for dry-run, missing workflow, confirmed removal,
      shared-artifact preservation, and legacy fallback output.
- [x] Implement workflow-record metadata persistence.
- [x] Implement remove planning and artifact deletion through runtime/plugin
      seams.
- [x] Wire root and compatibility remove commands.
- [x] Update help text and architecture/docs references.
- [x] Run focused tests after each vertical slice.

## 5. Verify And Archive

- [x] Run a scratch-home install/remove smoke check under `work/`.
- [x] Run `rtk bun run check`.
- [x] Record Pony Trail post-change evidence.
- [ ] Run `/opsx:archive` after human approval.
```

- [ ] **Step 6: Record Pony Trail verification snapshot**

Run a pre snapshot before the checklist update if not already in a matching snapshot:

```bash
rtk sh /Users/roy/.agents/skills/pony-trail/scripts/snapshot_change.sh --session-id remove-workflow-skills-command pre --files src/plugins/skill-installer.ts --files src/runtimes/getsuperpower/workflow-bundles.ts --files src/getsuperpower.ts --files tests/skill-installer.test.ts --files tests/workflow-bundles.test.ts --files tests/getsuperpower.test.ts --files tests/cli.test.ts --files docs/architecture.md --files openspec/changes/remove-workflow-skills-by-name/tasks.md --action "record verification" --purpose "Preserve verification evidence for workflow skill removal" --reason "Implementation and verification are complete" --expected "Snapshot captures final implementation state and verification commands" --verify "rtk bun run check" --rollback "Use git revert on implementation commits or restore files from this snapshot"
```

Run the matching post snapshot with the printed snapshot id:

```bash
rtk sh /Users/roy/.agents/skills/pony-trail/scripts/snapshot_change.sh --session-id remove-workflow-skills-command post --snapshot-id "<snapshot-id>" --files src/plugins/skill-installer.ts --files src/runtimes/getsuperpower/workflow-bundles.ts --files src/getsuperpower.ts --files tests/skill-installer.test.ts --files tests/workflow-bundles.test.ts --files tests/getsuperpower.test.ts --files tests/cli.test.ts --files docs/architecture.md --files openspec/changes/remove-workflow-skills-by-name/tasks.md --summary "Implemented workflow skill removal by workflow name" --checks "rtk bun test tests/skill-installer.test.ts; rtk bun test tests/workflow-bundles.test.ts; rtk bun test tests/getsuperpower.test.ts; rtk bun test tests/cli.test.ts; rtk openspec validate remove-workflow-skills-by-name --strict; rtk bun run check" --result "pass"
```

- [ ] **Step 7: Commit verification and checklist**

```bash
rtk git add docs/architecture.md openspec/changes/remove-workflow-skills-by-name/tasks.md .getsuperpower/snapshots.jsonl .getsuperpower/sessions/remove-workflow-skills-command/tree.md
rtk git commit -m "docs: verify workflow skill removal"
```

## Self-Review

- Spec coverage: Tasks 1-6 cover artifact metadata, install record persistence, removal planning, shared artifact protection, legacy fallback, root and compatibility commands, dry-run, missing workflow, docs, smoke checks, OpenSpec validation, and full check.
- Completion-marker scan: the plan has no unfinished marker words or vague "add tests" steps. Each code task includes exact tests, implementation snippets, commands, and expected outcomes.
- Type consistency: `WorkflowInstallSkillArtifact`, `WorkflowRemovalPlan`, `artifactPaths`, `createWorkflowRemovalPlan()`, `executeWorkflowRemovalPlan()`, and `GetSuperpowerRemovePrompt` are named consistently across tasks.
