import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createWorkflowBundleScaffold,
  installWorkflowBundle,
  listInstalledWorkflowBundles,
  loadWorkflowBundle,
} from "../src/runtimes/ponytrail/workflow-bundles";

describe("workflow bundles", () => {
  test("loads the bundled product-dev workflow", async () => {
    const bundle = await loadWorkflowBundle("product-dev");

    expect(bundle.manifest.name).toBe("product-dev");
    expect(bundle.manifest.skills.map((skill) => skill.source)).toEqual([
      "superpowers:brainstorming",
      "superpowers:writing-plans",
      "pony-trail",
    ]);
    expect(bundle.manifest.steps.map((step) => [step.id, step.skill])).toEqual([
      ["shape", "superpowers:brainstorming"],
      ["plan", "superpowers:writing-plans"],
      ["evidence", "pony-trail"],
    ]);
  });

  test("rejects duplicate workflow step ids", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-bundle-"));
    const bundleDir = join(rootDir, "duplicate-steps");
    await mkdir(bundleDir, { recursive: true });
    await writeFile(
      join(bundleDir, "workflow.json"),
      JSON.stringify(
        {
          schemaVersion: "0.1",
          name: "duplicate-steps",
          version: "0.1.0",
          description: "Invalid duplicate step ids.",
          skills: [{ source: "pony-trail" }],
          steps: [
            { id: "same", title: "First", skill: "pony-trail" },
            { id: "same", title: "Second", skill: "pony-trail" },
          ],
        },
        null,
        2,
      ),
    );

    await expect(loadWorkflowBundle(bundleDir)).rejects.toThrow("Duplicate workflow step id: same");
  });

  test("scaffolds an authorable workflow bundle with a local skill", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-bundle-scaffold-"));

    const scaffold = await createWorkflowBundleScaffold({
      rootDir,
      name: "release-review",
    });

    await expect(stat(join(scaffold.bundleDir, "workflow.json"))).resolves.toBeTruthy();
    await expect(
      stat(join(scaffold.bundleDir, "skills", "custom-review", "SKILL.md")),
    ).resolves.toBeTruthy();
    await expect(
      stat(join(scaffold.bundleDir, "skills", "release-review", "SKILL.md")),
    ).resolves.toBeTruthy();

    const bundle = await loadWorkflowBundle(scaffold.bundleDir);
    expect(bundle.manifest.name).toBe("release-review");
    expect(bundle.manifest.skills.map((skill) => skill.source)).toContain(
      "./skills/release-review",
    );
    expect(bundle.manifest.skills.map((skill) => skill.source)).toContain("./skills/custom-review");
    await expect(readFile(scaffold.readmePath, "utf8")).resolves.toContain(
      "A GetSuperpower that composes reusable agent skills.",
    );
    await expect(
      readFile(join(scaffold.bundleDir, "skills", "release-review", "SKILL.md"), "utf8"),
    ).resolves.toContain("This is the entry skill for the release-review GetSuperpower.");
    await expect(
      readFile(join(scaffold.bundleDir, "skills", "custom-review", "SKILL.md"), "utf8"),
    ).resolves.toContain("Review this GetSuperpower from the author perspective.");
  });

  test("loads the release-review example workflow with its local skill", async () => {
    const bundle = await loadWorkflowBundle("examples/workflows/release-review");

    expect(bundle.manifest.name).toBe("release-review");
    expect(bundle.manifest.skills.map((skill) => skill.source)).toContain(
      "./skills/release-risk-review",
    );
    expect(bundle.manifest.steps.map((step) => step.id)).toEqual([
      "shape",
      "release-risk-review",
      "plan",
      "evidence",
    ]);
  });

  test("loads the real-engineering example workflow with mattpocock skill sources", async () => {
    const bundle = await loadWorkflowBundle("examples/workflows/real-engineering");

    expect(bundle.manifest.name).toBe("real-engineering");
    expect(bundle.manifest.skills.map((skill) => skill.source)).toEqual([
      "./skills/rtk-command-discipline",
      "pony-trail",
      "superpowers:brainstorming",
      "superpowers:writing-plans",
      "mattpocock:grill-with-docs",
      "mattpocock:tdd",
      "mattpocock:codebase-design",
      "mattpocock:diagnosing-bugs",
    ]);
    expect(bundle.manifest.steps.map((step) => [step.id, step.skill])).toEqual([
      ["command-discipline", "./skills/rtk-command-discipline"],
      ["shape", "superpowers:brainstorming"],
      ["grill", "mattpocock:grill-with-docs"],
      ["plan", "superpowers:writing-plans"],
      ["design", "mattpocock:codebase-design"],
      ["tdd", "mattpocock:tdd"],
      ["debug", "mattpocock:diagnosing-bugs"],
      ["evidence", "pony-trail"],
    ]);
  });

  test("loads the openspec-superpowers example workflow from the handoff diagram", async () => {
    const bundle = await loadWorkflowBundle("examples/workflows/openspec-superpowers");

    expect(bundle.manifest.name).toBe("openspec-superpowers");
    expect(bundle.manifest.skills.map((skill) => skill.source)).toEqual([
      "./skills/openspec-superpowers",
      "./skills/opsx-handoff-review",
      "superpowers:brainstorming",
      "superpowers:writing-plans",
      "mattpocock:tdd",
      "pony-trail",
    ]);
    expect(bundle.manifest.steps.map((step) => [step.id, step.skill])).toEqual([
      ["opsx-propose", "./skills/opsx-handoff-review"],
      ["opsx-review", "./skills/opsx-handoff-review"],
      ["design-deepening", "superpowers:brainstorming"],
      ["implementation-plan", "superpowers:writing-plans"],
      ["task-by-task-build", "mattpocock:tdd"],
      ["verification", "pony-trail"],
      ["opsx-archive", "./skills/opsx-handoff-review"],
    ]);
    await expect(
      readFile(
        join(
          import.meta.dir,
          "..",
          "examples",
          "workflows",
          "openspec-superpowers",
          "skills",
          "openspec-superpowers",
          "SKILL.md",
        ),
        "utf8",
      ),
    ).resolves.toContain("This is the entry skill for the openspec-superpowers GetSuperpower.");
  });

  test("installs and lists workflow bundles under .ponyrace", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-bundle-install-"));
    const bundle = await loadWorkflowBundle("product-dev");

    const installed = await installWorkflowBundle({
      rootDir,
      bundle,
    });

    expect(installed.path).toBe(join(rootDir, ".ponyrace", "workflows", "product-dev.json"));
    const installedFile = JSON.parse(await readFile(installed.path, "utf8"));
    expect(installedFile.name).toBe("product-dev");
    expect(installedFile.steps).toHaveLength(3);

    const workflows = await listInstalledWorkflowBundles({ rootDir });
    expect(workflows.map((workflow) => workflow.name)).toEqual(["product-dev"]);
  });
});
