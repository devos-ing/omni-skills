import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildProgram,
  type GoalClarificationPrompter,
  promptForSetup,
  type SetupPrompter,
  type SetupPromptIo,
} from "../src/cli";
import type { CliInvocation, CliStreamRunner } from "../src/plugins";
import type { RequirementPonyRunner } from "../src/runtimes/ponytrail";
import { createDefaultSetupReviewBots } from "../src/runtimes/ponytrail/manifest";

describe("cli", () => {
  test("registers setup, onboarding, bot listing, goal drafting, and vote commands", () => {
    const program = buildProgram();

    expect(program.name()).toBe("ponyrace");
    expect(program.commands.map((command) => command.name())).toEqual([
      "setup",
      "onboard",
      "bots",
      "goal",
      "ponyrace",
      "vote",
      "stream-goal",
      "history",
      "revert",
      "skills",
    ]);

    const setupCommand = program.commands.find((command) => command.name() === "setup");
    const onboardCommand = program.commands.find((command) => command.name() === "onboard");
    const ponyraceCommand = program.commands.find((command) => command.name() === "ponyrace");
    const streamGoalCommand = program.commands.find((command) => command.name() === "stream-goal");
    const revertCommand = program.commands.find((command) => command.name() === "revert");
    const skillsCommand = program.commands.find((command) => command.name() === "skills");

    expect(setupCommand?.options.map((option) => option.long)).toEqual([
      "--dir",
      "--name",
      "--agents",
      "--home",
    ]);
    expect(onboardCommand?.options.map((option) => option.long)).toEqual([
      "--dir",
      "--name",
      "--agents",
      "--home",
    ]);
    expect(ponyraceCommand?.options.map((option) => option.long)).toEqual([
      "--manifest",
      "--worker",
      "--research",
      "--json",
      "--markdown",
      "--skip-markdown",
    ]);
    expect(streamGoalCommand?.options.map((option) => option.long)).toEqual([
      "--manifest",
      "--worker",
    ]);
    expect(revertCommand?.options.map((option) => option.long)).toEqual(["--dry-run"]);
    expect(skillsCommand?.commands.map((command) => command.name())).toEqual(["install", "update"]);
  });

  test("prints the CLI version with -v", async () => {
    const program = buildProgram();
    const expectedVersion = "0.2.0";
    const output: string[] = [];

    expect(program.version()).toBe(expectedVersion);

    program.exitOverride();
    program.configureOutput({
      writeOut: (value) => output.push(value),
      writeErr: (value) => output.push(value),
    });

    await expect(program.parseAsync(["-v"], { from: "user" })).rejects.toMatchObject({
      code: "commander.version",
      exitCode: 0,
      message: expectedVersion,
    });
    expect(output.join("")).toBe(`${expectedVersion}\n`);
  });

  test("runs onboarding and manifest-backed commands", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: rootDir }).parseAsync(
        ["onboard", "--dir", ".", "--name", "CLI Court", "--home", rootDir],
        { from: "user" },
      );

      await buildProgram({ cwd: rootDir }).parseAsync(["bots"], { from: "user" });

      await buildProgram({ cwd: rootDir }).parseAsync(
        ["goal", "Add", "CSV", "import", "to", "admin", "dashboard", "--json"],
        {
          from: "user",
        },
      );

      await buildProgram({ cwd: rootDir }).parseAsync(
        [
          "vote",
          "--json",
          "--votes",
          JSON.stringify([
            {
              botId: "product_manager_bot",
              vote: "approve",
              confidence: 0.9,
              reason: "Matches intent.",
              requiredChanges: [],
            },
            {
              botId: "project_manager_bot",
              vote: "approve",
              confidence: 0.8,
              reason: "Can be planned.",
              requiredChanges: [],
            },
            {
              botId: "engineer_bot",
              vote: "approve",
              confidence: 0.7,
              reason: "Feasible.",
              requiredChanges: [],
            },
            {
              botId: "testing_bot",
              vote: "amend",
              confidence: 0.6,
              reason: "Needs evidence.",
              requiredChanges: ["Add test output."],
            },
          ]),
        ],
        { from: "user" },
      );

      expect(logs.some((line) => line.includes("Ponyrace onboarding complete"))).toBe(true);
      expect(logs.some((line) => line.includes("product_manager_bot"))).toBe(true);
      expect(logs.some((line) => line.includes("product_manager_model"))).toBe(true);
      expect(
        logs.some((line) => line.includes('"title": "Add CSV import to admin dashboard"')),
      ).toBe(true);
      expect(logs.some((line) => line.includes('"approved": true'))).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("onboard prompts for the workspace name and installs the bundled skills", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const homeDir = await mkdtemp(join(tmpdir(), "ponytrail-skill-home-"));
    const logs: string[] = [];
    const promptedDefaults: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({
        cwd: rootDir,
        projectNamePrompter: async (defaultName: string) => {
          promptedDefaults.push(defaultName);
          return "Prompted Workspace";
        },
      }).parseAsync(["onboard", "--home", homeDir], { from: "user" });

      for (const skill of ["pony-trail", "ponyrace"]) {
        await expect(
          stat(join(homeDir, ".claude", "skills", skill, "SKILL.md")),
        ).resolves.toBeTruthy();
        await expect(
          stat(join(homeDir, ".agents", "skills", skill, "SKILL.md")),
        ).resolves.toBeTruthy();
        await expect(
          stat(join(homeDir, ".codex", "skills", skill, "SKILL.md")),
        ).resolves.toBeTruthy();
      }
      const manifest = JSON.parse(
        await readFile(join(rootDir, ".ponyrace", "manifest.json"), "utf8"),
      );
      expect(manifest.metadata.name).toBe("Prompted Workspace");
      expect(promptedDefaults).toEqual([rootDir.slice(rootDir.lastIndexOf("/") + 1)]);
      expect(logs.some((line) => line.includes("Skill install result"))).toBe(true);
      expect(logs.some((line) => line.includes("Skill: pony-trail"))).toBe(true);
      expect(logs.some((line) => line.includes("Skill: ponyrace"))).toBe(true);
      expect(logs.some((line) => line.includes("Ponyrace onboarding complete"))).toBe(true);
      expect(stripAnsiLines(logs)).toContain("Welcome to Ponyrace.");
      expect(logs.some((line) => line.includes("Restart your agent IDE"))).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("setup creates a manifest and installs ponyrace skills for default agent targets", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const homeDir = await mkdtemp(join(tmpdir(), "ponytrail-skill-home-"));
    const logs: string[] = [];
    const promptedDefaults: Array<{
      projectName: string;
      agents: string;
      botCount: number;
    }> = [];
    const originalLog = console.log;
    const clarificationPrompter: GoalClarificationPrompter = async () => {
      throw new Error("setup must not ask goal clarification");
    };
    const setupPrompter: SetupPrompter = async (defaults) => {
      promptedDefaults.push({
        projectName: defaults.projectName,
        agents: defaults.agents,
        botCount: defaults.bots.length,
      });

      return { ...defaults, projectName: "Setup Court" };
    };

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: rootDir, setupPrompter, clarificationPrompter }).parseAsync(
        ["setup", "--home", homeDir],
        { from: "user" },
      );

      for (const skill of ["pony-trail", "ponyrace"]) {
        await expect(
          stat(join(homeDir, ".claude", "skills", skill, "SKILL.md")),
        ).resolves.toBeTruthy();
        await expect(
          stat(join(homeDir, ".codex", "skills", skill, "SKILL.md")),
        ).resolves.toBeTruthy();
        await expect(
          stat(join(homeDir, ".agents", "skills", skill, "SKILL.md")),
        ).resolves.toBeTruthy();
        await expect(stat(join(homeDir, ".cursor", "rules", `${skill}.mdc`))).resolves.toBeTruthy();
      }

      const manifest = JSON.parse(
        await readFile(join(rootDir, ".ponyrace", "manifest.json"), "utf8"),
      );
      expect(manifest.metadata.name).toBe("Setup Court");
      expect(manifest.kind).toBe("ai-work-runtime.ponytrail.setup");
      expect(manifest).not.toHaveProperty("bots");
      expect(manifest).not.toHaveProperty("models");
      expect(manifest).not.toHaveProperty("deliberation");
      expect(manifest.ponies.map((pony: { id: string }) => pony.id)).toEqual([
        "product_manager_bot",
        "project_manager_bot",
        "senior_engineer_bot",
        "testing_bot",
      ]);
      expect(manifest.approvalRule.requiredApprovals).toBe(3);
      expect(promptedDefaults).toContainEqual({
        projectName: rootDir.slice(rootDir.lastIndexOf("/") + 1),
        agents: "codex,claude,cursor",
        botCount: 4,
      });
      expect(logs.some((line) => line.includes("Ponyrace setup complete"))).toBe(true);
      expect(logs.some((line) => line.includes("Next: restart Codex or Claude"))).toBe(true);
      expect(logs.some((line) => line.includes("Pony race"))).toBe(false);
      expect(logs.some((line) => line.includes("Requirement discussion"))).toBe(false);
      expect(logs.some((line) => line.includes("Detailed requirement"))).toBe(false);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("setup does not print completion when skill install fails after manifest creation", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const invalidHomePath = join(rootDir, "home-file");
    const logs: string[] = [];
    const originalLog = console.log;
    const setupPrompter: SetupPrompter = async (defaults) => ({
      ...defaults,
      projectName: "Install Failure Setup",
    });

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeFile(invalidHomePath, "not a directory");

      await expect(
        buildProgram({ cwd: rootDir, setupPrompter }).parseAsync(
          ["setup", "--home", invalidHomePath],
          { from: "user" },
        ),
      ).rejects.toThrow();

      await expect(stat(join(rootDir, ".ponyrace", "manifest.json"))).resolves.toBeTruthy();
      expect(logs.some((line) => line.includes("Ponyrace setup complete"))).toBe(false);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("setup prompt recalculates custom approval default from selected bot count", async () => {
    const textDefaults: Array<{ message: string; defaultValue: string }> = [];
    const promptIo: SetupPromptIo = {
      isTty: true,
      intro: () => {},
      outro: () => {},
      text: async ({ message, defaultValue }) => {
        textDefaults.push({ message, defaultValue });
        if (message === "Workspace name") {
          return "Prompted Setup";
        }
        if (message === "Review bot count") {
          return "5";
        }
        if (message === "Skill install targets") {
          return "codex";
        }
        return defaultValue;
      },
      select: async () => "custom",
      confirm: async () => true,
      isCancel: () => false,
    };

    const result = await promptForSetup(
      {
        projectName: "Default Setup",
        bots: createDefaultSetupReviewBots(),
        requiredApprovals: 3,
        agents: "codex,claude,cursor",
      },
      promptIo,
    );

    expect(result.projectName).toBe("Prompted Setup");
    expect(result.bots.length).toBe(5);
    expect(result.bots.at(-1)?.id).toBe("review_bot_5");
    expect(result.requiredApprovals).toBe(4);
    expect(result.agents).toBe("codex");
    expect(textDefaults).toContainEqual({ message: "Required approvals", defaultValue: "4" });
  });

  test("setup prompt captures panel, instruction, and non-voting bot choices", async () => {
    const promptIo: SetupPromptIo = {
      isTty: true,
      intro: () => {},
      outro: () => {},
      text: async ({ message, defaultValue }) => {
        if (message === "Review bot count") {
          return "2";
        }
        if (message === "Bot 2 display name") {
          return "Observer Bot";
        }
        if (message === "Observer Bot role") {
          return "Observer";
        }
        if (message === "Observer Bot id") {
          return "observer_bot";
        }
        if (message === "Observer Bot panel") {
          return "advisory_panel";
        }
        if (message === "Observer Bot instruction") {
          return "Observe the discussion without voting.";
        }
        if (message === "Observer Bot model id") {
          return "observer_model";
        }
        if (message === "Observer Bot model name") {
          return "observer-review-model";
        }
        return defaultValue;
      },
      select: async () => "default",
      confirm: async ({ message }) => message !== "Observer Bot votes",
      isCancel: () => false,
    };

    const result = await promptForSetup(
      {
        projectName: "Default Setup",
        bots: createDefaultSetupReviewBots(),
        requiredApprovals: 3,
        agents: "codex,claude,cursor",
      },
      promptIo,
    );

    expect(result.bots).toHaveLength(2);
    expect(result.bots[1]).toMatchObject({
      id: "observer_bot",
      displayName: "Observer Bot",
      role: "Observer",
      panel: "advisory_panel",
      instruction: "Observe the discussion without voting.",
      modelId: "observer_model",
      modelName: "observer-review-model",
      votes: false,
    });
    expect(result.requiredApprovals).toBe(1);
  });

  test("setup accepts a custom bot roster and approval count", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const homeDir = await mkdtemp(join(tmpdir(), "ponytrail-skill-home-"));
    const logs: string[] = [];
    const originalLog = console.log;
    const clarificationPrompter: GoalClarificationPrompter = async () => {
      throw new Error("setup must not ask goal clarification");
    };
    const setupPrompter: SetupPrompter = async (defaults) => ({
      ...defaults,
      projectName: "Custom Setup",
      agents: "codex",
      requiredApprovals: 2,
      bots: [
        {
          id: "product_bot",
          displayName: "Product Bot",
          role: "Product",
          modelId: "product_model",
          modelName: "product-review-model",
          votes: true,
        },
        {
          id: "engineering_bot",
          displayName: "Engineering Bot",
          role: "Engineering",
          modelId: "engineering_model",
          modelName: "engineering-review-model",
          votes: true,
        },
        {
          id: "observer_bot",
          displayName: "Observer Bot",
          role: "Observer",
          modelId: "observer_model",
          modelName: "observer-review-model",
          votes: false,
        },
      ],
    });

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: rootDir, setupPrompter, clarificationPrompter }).parseAsync(
        ["setup", "--name", "Ignored By Prompter", "--home", homeDir],
        { from: "user" },
      );

      for (const skill of ["pony-trail", "ponyrace"]) {
        await expect(
          stat(join(homeDir, ".codex", "skills", skill, "SKILL.md")),
        ).resolves.toBeTruthy();
        await expect(
          stat(join(homeDir, ".agents", "skills", skill, "SKILL.md")),
        ).resolves.toBeTruthy();
        await expect(stat(join(homeDir, ".claude", "skills", skill, "SKILL.md"))).rejects.toThrow();
        await expect(stat(join(homeDir, ".cursor", "rules", `${skill}.mdc`))).rejects.toThrow();
      }

      const manifest = JSON.parse(
        await readFile(join(rootDir, ".ponyrace", "manifest.json"), "utf8"),
      );
      expect(manifest.metadata.name).toBe("Custom Setup");
      expect(manifest.kind).toBe("ai-work-runtime.ponytrail.setup");
      expect(manifest).not.toHaveProperty("bots");
      expect(manifest).not.toHaveProperty("models");
      expect(manifest).not.toHaveProperty("deliberation");
      expect(
        manifest.ponies
          .filter((pony: { votes?: boolean }) => pony.votes !== false)
          .map((pony: { id: string }) => pony.id),
      ).toEqual(["product_bot", "engineering_bot"]);
      expect(manifest.approvalRule.requiredApprovals).toBe(2);
      expect(manifest.ponies.some((pony: { id: string }) => pony.id === "observer_bot")).toBe(true);
      expect(
        manifest.ponies.find((pony: { id: string; modelId?: string }) => pony.id === "observer_bot")
          ?.modelId,
      ).toBe("observer_model");
      expect(
        manifest.ponies.some(
          (pony: { modelId: string; modelName: string }) =>
            pony.modelId === "observer_model" && pony.modelName === "observer-review-model",
        ),
      ).toBe(true);
      expect(logs.some((line) => line.includes("Skill: pony-trail"))).toBe(true);
      expect(logs.some((line) => line.includes("Skill: ponyrace"))).toBe(true);
      expect(logs.some((line) => line.includes("Pony race"))).toBe(false);
      expect(logs.some((line) => line.includes("Requirement discussion"))).toBe(false);
      expect(logs.some((line) => line.includes("Detailed requirement"))).toBe(false);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("onboard refreshes an older installed bundled skill", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const homeDir = await mkdtemp(join(tmpdir(), "ponytrail-skill-home-"));
    const installedSkillPath = join(homeDir, ".agents", "skills", "pony-trail", "SKILL.md");
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await mkdir(join(homeDir, ".agents", "skills", "pony-trail"), { recursive: true });
      await writeFile(installedSkillPath, "stale pony trail skill");

      await buildProgram({ cwd: rootDir }).parseAsync(
        ["onboard", "--name", "Refresh Workspace", "--home", homeDir, "--agents", "codex"],
        { from: "user" },
      );

      expect(await readFile(installedSkillPath, "utf8")).toContain("name: pony-trail");
      expect(logs.some((line) => line.includes("codex: updated"))).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("prints clarification questions for unclear goal requests in non-interactive mode", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: rootDir }).parseAsync(
        ["onboard", "--dir", ".", "--name", "CLI Court", "--home", rootDir],
        { from: "user" },
      );

      await buildProgram({ cwd: rootDir }).parseAsync(["goal", "make", "it", "better"], {
        from: "user",
      });

      expect(logs.some((line) => line.includes("Needs clarification"))).toBe(true);
      expect(logs.some((line) => line.includes("What specific outcome"))).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("goal prints requirement court discussion and does not stream by default", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: rootDir }).parseAsync(
        ["onboard", "--dir", ".", "--name", "CLI Court", "--home", rootDir],
        { from: "user" },
      );

      await buildProgram({ cwd: rootDir }).parseAsync(
        ["goal", "Add", "CSV", "import", "to", "admin", "dashboard"],
        { from: "user" },
      );

      expect(stripAnsiLines(logs)).toContain("Requirement discussion");
      expect(logs.some((line) => line.includes("product_manager_bot: I think"))).toBe(true);
      expect(logs.some((line) => line.includes("project_manager_bot: I think"))).toBe(true);
      expect(logs.some((line) => line.includes("engineer_bot: I think"))).toBe(true);
      expect(logs.some((line) => line.includes("testing_bot: I think"))).toBe(true);
      expect(stripAnsiLines(logs)).toContain("Judge summary");
      expect(logs.some((line) => line.includes("Approvals: 4/4"))).toBe(true);
      expect(stripAnsiLines(logs)).toContain("Detailed requirement");
      expect(logs.some((line) => line.includes("Title: Add CSV import to admin dashboard"))).toBe(
        true,
      );
      expect(stripAnsiLines(logs)).toContain("What will change:");
      expect(logs.some((line) => line === "- Add CSV import to admin dashboard")).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("ponyrace prints pony race discussion and does not stream by default", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: rootDir }).parseAsync(
        ["onboard", "--dir", ".", "--name", "CLI Court", "--home", rootDir],
        { from: "user" },
      );

      await buildProgram({ cwd: rootDir }).parseAsync(
        ["ponyrace", "Add", "CSV", "import", "to", "admin", "dashboard"],
        { from: "user" },
      );

      expect(stripAnsiLines(logs)).toContain("Pony race");
      expect(logs.some((line) => line.includes("product_manager_bot: I think"))).toBe(true);
      expect(logs.some((line) => line.includes("project_manager_bot: I think"))).toBe(true);
      expect(logs.some((line) => line.includes("engineer_bot: I think"))).toBe(true);
      expect(logs.some((line) => line.includes("testing_bot: I think"))).toBe(true);
      expect(stripAnsiLines(logs)).toContain("Visible thinking transcript");
      expect(stripAnsiLines(logs)).toContain("Round 1");
      expect(logs.some((line) => line.includes("Product Manager Bot (product_manager_bot)"))).toBe(
        true,
      );
      expect(logs.some((line) => line.includes("Focus:"))).toBe(true);
      expect(logs.some((line) => line.includes("Concern:"))).toBe(true);
      expect(logs.some((line) => line.includes("Recommendation:"))).toBe(true);
      expect(logs.some((line) => line.includes("Vote: approve"))).toBe(true);
      expect(stripAnsiLines(logs)).toContain("Judge summary");
      expect(logs.some((line) => line.includes("Approvals: 4/4"))).toBe(true);
      expect(stripAnsiLines(logs)).toContain("Detailed requirement");
      expect(logs.some((line) => line.includes("Title: Add CSV import to admin dashboard"))).toBe(
        true,
      );
      expect(stripAnsiLines(logs)).toContain("What will change:");
      expect(logs.some((line) => line === "- Add CSV import to admin dashboard")).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("ponyrace runs the configured pony runner and prints round output", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const ponyCalls: string[] = [];
    const originalLog = console.log;
    const ponyRunner: RequirementPonyRunner = async ({ bot, contract }) => {
      ponyCalls.push(bot.id);

      return {
        message: `${bot.id} accepted ${contract.title}`,
        visibleThinking: {
          focus: `Evaluate as ${bot.displayName}.`,
          concern: "Keep role-specific risks visible.",
          recommendation: "Approve the direction.",
        },
        vote: "approve",
        confidence: 0.91,
        requiredChanges: [],
      };
    };

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: rootDir, ponyRunner }).parseAsync(
        ["onboard", "--dir", ".", "--name", "CLI Court", "--home", rootDir],
        { from: "user" },
      );

      await buildProgram({ cwd: rootDir, ponyRunner }).parseAsync(
        ["ponyrace", "Add", "CSV", "import", "to", "admin", "dashboard"],
        { from: "user" },
      );

      expect(ponyCalls).toEqual([
        "product_manager_bot",
        "project_manager_bot",
        "engineer_bot",
        "testing_bot",
      ]);
      expect(stripAnsiLines(logs)).toContain("Pony race");
      expect(stripAnsiLines(logs)).toContain("Round 1");
      expect(logs.some((line) => line.includes("product_manager_bot accepted"))).toBe(true);
      expect(stripAnsiLines(logs)).toContain("Visible thinking transcript");
      expect(stripAnsiLines(logs)).toContain("Final votes");
      expect(logs.some((line) => line.includes("product_manager_bot: approve (0.91)"))).toBe(true);
      expect(logs.some((line) => line.includes("Human confirmation: pending"))).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("ponyrace research mode runs each pony through the selected worker adapter and prints evidence", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const invocations: CliInvocation[] = [];
    const originalLog = console.log;
    const streamRunner: CliStreamRunner = async function* (invocation) {
      invocations.push(invocation);
      yield { type: "start", invocation };
      yield {
        type: "stdout",
        chunk: JSON.stringify({
          message: "Researched approval with role evidence.",
          visibleThinking: {
            focus: "Use role skills before voting.",
            concern: "Approval must be backed by concrete evidence.",
            recommendation: "Approve after checking the skill-guided evidence.",
          },
          evidence: ["Skill-guided evidence from the researched pony prompt."],
          vote: "approve",
          confidence: 0.93,
          requiredChanges: [],
        }),
      };
      yield { type: "exit", exitCode: 0 };
    };

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: rootDir, streamRunner }).parseAsync(
        ["onboard", "--dir", ".", "--name", "CLI Court", "--home", rootDir],
        { from: "user" },
      );
      logs.splice(0);

      await buildProgram({ cwd: rootDir, streamRunner }).parseAsync(
        ["ponyrace", "--research", "--worker", "codex", "Add", "CSV", "import", "to", "admin"],
        { from: "user" },
      );

      const prompt = invocations[0]?.args.join(" ") ?? "";
      expect(invocations).toHaveLength(4);
      expect(invocations.every((invocation) => invocation.executable === "codex")).toBe(true);
      expect(prompt).toContain("Requirement pony review");
      expect(prompt).toContain("Pony skills:");
      expect(prompt).toContain("Compare the draft goal against the user's raw request");
      expect(prompt).toContain("Do not approve without at least one concrete evidence item.");
      expect(stripAnsiLines(logs)).toContain("Pony race");
      expect(stripAnsiLines(logs)).toContain("Visible thinking transcript");
      expect(stripAnsiLines(logs)).toContain("Evidence:");
      expect(logs.some((line) => line.includes("Skill-guided evidence"))).toBe(true);
      expect(logs.some((line) => line.includes("product_manager_bot: approve (0.93)"))).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("ponyrace prints the approved streaming sections in user-flow order", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: rootDir }).parseAsync(
        ["onboard", "--dir", ".", "--name", "CLI Court", "--home", rootDir],
        { from: "user" },
      );
      logs.splice(0);

      await buildProgram({ cwd: rootDir }).parseAsync(
        ["ponyrace", "--worker", "codex", "Verify", "streaming", "order", "and", "human", "gate"],
        { from: "user" },
      );

      const lines = stripAnsiLines(logs);
      const orderedSections = [
        "Pony race",
        "Round 1",
        "Visible thinking transcript",
        "Judge summary",
        "Final votes",
        "Detailed requirement",
        "Human confirmation: pending",
      ].map((section) => lines.findIndex((line) => line.includes(section)));

      expect(orderedSections.every((index) => index >= 0)).toBe(true);
      expect(orderedSections).toEqual([...orderedSections].sort((left, right) => left - right));
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("ponyrace writes the default markdown report under .ponyrace after the summary", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: rootDir }).parseAsync(
        ["onboard", "--dir", ".", "--name", "CLI Court", "--home", rootDir],
        { from: "user" },
      );
      logs.splice(0);

      await buildProgram({ cwd: rootDir }).parseAsync(
        ["ponyrace", "Add", "CSV", "import", "to", "admin", "dashboard"],
        { from: "user" },
      );

      const lines = stripAnsiLines(logs);
      const judgeSummaryIndex = lines.findIndex((line) => line.includes("Judge summary"));
      const reportLineIndex = lines.findIndex((line) => line.startsWith("Markdown report: "));
      const finalVotesIndex = lines.findIndex((line) => line.includes("Final votes"));
      const reportPath = lines[reportLineIndex]?.replace("Markdown report: ", "") ?? "";

      expect(reportPath.startsWith(".ponyrace/ponyrace/")).toBe(true);
      expect(reportPath.endsWith("-add-csv-import-to-admin-dashboard.md")).toBe(true);
      expect(reportLineIndex).toBeGreaterThan(judgeSummaryIndex);
      expect(reportLineIndex).toBeLessThan(finalVotesIndex);

      const report = await readFile(join(rootDir, reportPath), "utf8");
      expect(report).toContain("# Pony race: Add CSV import to admin dashboard");
      expect(report).toContain("Human confirmation: pending");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("ponyrace JSON output includes court discussion results", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const ponyCalls: string[] = [];
    const originalLog = console.log;
    const ponyRunner: RequirementPonyRunner = async ({ bot }) => {
      ponyCalls.push(bot.id);

      return {
        message: `${bot.id} json review`,
        vote: "approve",
        confidence: 0.88,
        requiredChanges: [],
      };
    };

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: rootDir, ponyRunner }).parseAsync(
        ["onboard", "--dir", ".", "--name", "CLI Court", "--home", rootDir],
        { from: "user" },
      );

      await buildProgram({ cwd: rootDir, ponyRunner }).parseAsync(
        ["ponyrace", "--json", "Add", "CSV", "import", "to", "admin", "dashboard"],
        { from: "user" },
      );

      const output = JSON.parse(logs.at(-1) ?? "{}");
      expect(ponyCalls).toEqual([
        "product_manager_bot",
        "project_manager_bot",
        "engineer_bot",
        "testing_bot",
      ]);
      expect(output.rounds.map((round: { round: number }) => round.round)).toEqual([1]);
      expect(output.discussion[0].message).toBe("product_manager_bot json review");
      expect(output.votes[0].confidence).toBe(0.88);
      expect(output.humanConfirmation).toBe("pending");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("ponyrace writes a markdown discussion report with pony thinking and change summary", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const reportPath = join("outputs", "ponyrace-report.md");
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: rootDir }).parseAsync(
        ["onboard", "--dir", ".", "--name", "CLI Court", "--home", rootDir],
        { from: "user" },
      );
      logs.splice(0);

      await buildProgram({ cwd: rootDir }).parseAsync(
        ["ponyrace", "--markdown", reportPath, "Add", "CSV", "import", "to", "admin", "dashboard"],
        { from: "user" },
      );

      const report = await readFile(join(rootDir, reportPath), "utf8");

      expect(stripAnsiLines(logs)).toContain(`Markdown report: ${reportPath}`);
      expect(report).toContain("# Pony race: Add CSV import to admin dashboard");
      expect(report).toContain("## Discussion");
      expect(report).toContain("product_manager_bot: I think");
      expect(report).toContain("## Visible Thinking Transcript");
      expect(report).toContain("### Product Manager Bot (product_manager_bot)");
      expect(report).toContain("Focus:");
      expect(report).toContain("Concern:");
      expect(report).toContain("Recommendation:");
      expect(report).toContain("Vote: approve");
      expect(report).toContain("## Judge Summary");
      expect(report).toContain("Approvals: 4/4");
      expect(report).toContain("## Approval Tally");
      expect(report).toContain("- product_manager_bot: approve (0.8)");
      expect(report).toContain("## Detailed Requirement");
      expect(report).toContain("Title: Add CSV import to admin dashboard");
      expect(report).toContain("## Change Summary");
      expect(report).toContain("### What Will Change");
      expect(report).toContain("- Add CSV import to admin dashboard");
      expect(report).toContain("Human confirmation: pending");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("stream-goal remains a compatibility alias for requirement discussion", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: rootDir }).parseAsync(
        ["onboard", "--dir", ".", "--name", "CLI Court", "--home", rootDir],
        { from: "user" },
      );

      await buildProgram({ cwd: rootDir }).parseAsync(
        ["stream-goal", "--worker", "claude", "Review", "checkout", "test", "plan", "evidence"],
        { from: "user" },
      );

      expect(stripAnsiLines(logs)).toContain("Requirement discussion");
      expect(logs.some((line) => line.includes("testing_bot: I think"))).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("goal asks for custom clarification answers before requirement court discussion", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const originalLog = console.log;
    const clarificationPrompter: GoalClarificationPrompter = async ({ questions }) => ({
      answers: questions.map((question, index) => ({
        question,
        mode: "custom",
        answer:
          [
            "Create an admin dashboard CSV importer.",
            "Limit scope to the admin dashboard import workflow.",
            "Show passing tests and a successful import smoke result.",
          ][index] ?? "Clarified detail.",
      })),
    });

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: rootDir, clarificationPrompter }).parseAsync(
        ["onboard", "--dir", ".", "--name", "CLI Court", "--home", rootDir],
        { from: "user" },
      );

      await buildProgram({ cwd: rootDir, clarificationPrompter }).parseAsync(
        ["goal", "make", "it", "better"],
        { from: "user" },
      );

      expect(logs.some((line) => line.includes("Needs clarification"))).toBe(true);
      expect(stripAnsiLines(logs)).toContain("Requirement discussion");
      expect(logs.some((line) => line.includes("engineer_bot: I think"))).toBe(true);
      expect(logs.some((line) => line.includes("Create an admin dashboard CSV importer"))).toBe(
        true,
      );
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("skills install dry-runs bundled pony trail skill installation for npx and bunx usage", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "ponytrail-skill-home-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: homeDir }).parseAsync(
        ["skills", "install", "pony-trail", "--home", homeDir, "--dry-run"],
        { from: "user" },
      );

      expect(stripAnsiLines(logs)).toContain("Skill install plan");
      expect(logs.some((line) => line.includes("pony-trail"))).toBe(true);
      expect(logs.some((line) => line.includes("claude: would install"))).toBe(true);
      expect(logs.some((line) => line.includes("copilot: would install"))).toBe(true);
      expect(logs.some((line) => line.includes("codex: would install"))).toBe(true);
      expect(logs.some((line) => line.includes("cursor: would install"))).toBe(true);
      expect(logs.some((line) => line.includes(".cursor/rules/pony-trail.mdc"))).toBe(true);
      expect(stripAnsiLines(logs)).not.toContain("Welcome to Ponyrace.");
    } finally {
      console.log = originalLog;
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("skills install accepts previous bundled skill names as aliases", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "ponytrail-skill-home-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      for (const alias of [
        "record-change-evidence",
        "enter-into-evidence",
        "snapshotting-file-changes",
      ]) {
        await buildProgram({ cwd: homeDir }).parseAsync(
          ["skills", "install", alias, "--home", homeDir, "--dry-run"],
          { from: "user" },
        );
      }

      expect(stripAnsiLines(logs)).toContain("Skill install plan");
      expect(logs.some((line) => line.includes("pony-trail"))).toBe(true);
      expect(logs.some((line) => line.includes("claude: would install"))).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("skills install can dry-run prehook installation", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "ponytrail-skill-home-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: homeDir }).parseAsync(
        ["skills", "install", "pony-trail", "--home", homeDir, "--prehook", "--dry-run"],
        { from: "user" },
      );

      expect(stripAnsiLines(logs)).toContain("Prehook install plan");
      expect(logs.some((line) => line.includes("claude: would install"))).toBe(true);
      expect(logs.some((line) => line.includes(".claude/hooks/ponytrail"))).toBe(true);
      expect(logs.some((line) => line.includes("codex: would install"))).toBe(true);
      expect(logs.some((line) => line.includes("copilot: would install"))).toBe(true);
      expect(logs.some((line) => line.includes("cursor: would install"))).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("skills install records a local project history commit", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const homeDir = await mkdtemp(join(tmpdir(), "ponytrail-skill-home-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: rootDir }).parseAsync(
        ["skills", "install", "pony-trail", "--home", homeDir, "--agents", "codex"],
        { from: "user" },
      );

      await expect(
        stat(join(homeDir, ".codex", "skills", "pony-trail", "SKILL.md")),
      ).resolves.toBeTruthy();
      expect(stripAnsiLines(logs)).toContain("Welcome to Ponyrace.");
      expect(logs.some((line) => line.includes("Restart your agent IDE"))).toBe(true);
      expect(logs.some((line) => line.includes("Local history:"))).toBe(true);

      await buildProgram({ cwd: rootDir }).parseAsync(["history", "--details"], { from: "user" });
      const historyLogs = logs.splice(0).map(stripAnsi);

      expect(historyLogs.some((line) => line.includes("ponyrace-skills"))).toBe(true);
      expect(historyLogs.some((line) => line.includes("action: install skill"))).toBe(true);
      expect(
        historyLogs.some((line) => line.includes("summary: Installed pony-trail skill for codex")),
      ).toBe(true);

      const entries = (await readFile(join(rootDir, ".ponyrace", "snapshots.jsonl"), "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(entries.map((entry) => entry.phase)).toEqual(["pre", "post"]);
      expect(entries.map((entry) => entry.session_id)).toEqual([
        "ponyrace-skills",
        "ponyrace-skills",
      ]);
      expect(entries[0].snapshot_id).toStartWith("skill-install-");

      const sessionTree = await readFile(
        join(rootDir, ".ponyrace", "sessions", "ponyrace-skills", "tree.md"),
        "utf8",
      );
      expect(sessionTree).toContain("Session: `ponyrace-skills`");
      expect(sessionTree).toContain("## commit skill-install-");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("skills update refreshes installed skill files and records a local project history commit", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const homeDir = await mkdtemp(join(tmpdir(), "ponytrail-skill-home-"));
    const installedSkillPath = join(homeDir, ".agents", "skills", "pony-trail", "SKILL.md");
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: rootDir }).parseAsync(
        ["skills", "install", "pony-trail", "--home", homeDir, "--agents", "codex"],
        { from: "user" },
      );
      await writeFile(installedSkillPath, "stale skill");
      logs.splice(0);

      await buildProgram({ cwd: rootDir }).parseAsync(
        ["skills", "update", "pony-trail", "--home", homeDir, "--agents", "codex"],
        { from: "user" },
      );

      expect(stripAnsiLines(logs)).toContain("Skill update result");
      expect(logs.some((line) => line.includes("codex: updated"))).toBe(true);
      expect(stripAnsiLines(logs)).toContain("Welcome to Ponyrace.");
      expect(logs.some((line) => line.includes("Restart your agent IDE"))).toBe(true);
      expect(logs.some((line) => line.includes("Local history:"))).toBe(true);
      expect(await readFile(installedSkillPath, "utf8")).toContain("name: pony-trail");

      await buildProgram({ cwd: rootDir }).parseAsync(["history", "--details"], { from: "user" });
      const historyLogs = logs.splice(0).map(stripAnsi);

      expect(historyLogs.some((line) => line.includes("action: update skill"))).toBe(true);
      expect(
        historyLogs.some((line) => line.includes("summary: Updated pony-trail skill for codex")),
      ).toBe(true);

      const entries = (await readFile(join(rootDir, ".ponyrace", "snapshots.jsonl"), "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(entries.at(-2)?.snapshot_id).toStartWith("skill-update-");
      expect(entries.at(-1)?.snapshot_id).toStartWith("skill-update-");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("history supports tree, details, and JSON output", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeSampleSnapshotLog(rootDir);

      await buildProgram({ cwd: rootDir }).parseAsync(["history"], { from: "user" });
      const treeLogs = logs.splice(0).map(stripAnsi);
      await buildProgram({ cwd: rootDir }).parseAsync(["history", "--details"], { from: "user" });
      const detailsLogs = logs.splice(0).map(stripAnsi);
      await buildProgram({ cwd: rootDir }).parseAsync(["history", "--json"], { from: "user" });
      const jsonLogs = logs.splice(0);

      expect(treeLogs).toEqual([
        "Snapshot history",
        "* session-alpha",
        "  * snapshot-001 (pre/post)",
      ]);
      expect(treeLogs.some((line) => line.includes("Updated note"))).toBe(false);
      expect(treeLogs.some((line) => line.includes("instruction_context"))).toBe(false);
      expect(detailsLogs).toContain("Snapshot history");
      expect(detailsLogs.some((line) => line.includes("session-alpha"))).toBe(true);
      expect(detailsLogs.some((line) => line.includes("snapshot-001"))).toBe(true);
      expect(detailsLogs.some((line) => line.includes("Updated note"))).toBe(true);
      expect(detailsLogs.some((line) => line.includes("instruction_context: pre"))).toBe(true);
      expect(detailsLogs.some((line) => line.includes("AGENTS.md captured sha256:aaaaaaaa"))).toBe(
        true,
      );
      expect(detailsLogs.some((line) => line.includes("git: main abc123 dirty"))).toBe(true);
      expect(jsonLogs.some((line) => line.includes('"sessionId": "session-alpha"'))).toBe(true);
      expect(jsonLogs.some((line) => line.includes('"instructionContexts"'))).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("revert dry-run prints planned snapshot actions without mutating files", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeSampleSnapshotLog(rootDir);

      await buildProgram({ cwd: rootDir }).parseAsync(["revert", "snapshot-001", "--dry-run"], {
        from: "user",
      });

      expect(stripAnsiLines(logs)).toContain("Snapshot revert plan");
      expect(logs.some((line) => line.includes("Would restore notes.txt"))).toBe(true);
      expect(logs.some((line) => line.includes("Would delete created.txt"))).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("revert asks for approval before applying", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const approvalRequests: Array<{ snapshotId: string; actions: number }> = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeSampleSnapshotLog(rootDir);
      const { writeFile } = await import("node:fs/promises");
      await writeFile(join(rootDir, "notes.txt"), "after\n");
      await writeFile(join(rootDir, "created.txt"), "created\n");

      await buildProgram({
        cwd: rootDir,
        revertApprovalPrompter: async ({ snapshotId, actions }) => {
          approvalRequests.push({ snapshotId, actions: actions.length });
          return true;
        },
      }).parseAsync(["revert", "snapshot-001"], { from: "user" });

      expect(approvalRequests).toEqual([{ snapshotId: "snapshot-001", actions: 2 }]);
      expect(stripAnsiLines(logs)).toContain("Snapshot revert plan");
      expect(logs.some((line) => line.includes("Would restore notes.txt"))).toBe(true);
      expect(logs.some((line) => line.includes("Would delete created.txt"))).toBe(true);
      expect(logs.some((line) => line.includes("Reverted snapshot snapshot-001"))).toBe(true);
      expect(await readFile(join(rootDir, "notes.txt"), "utf8")).toBe("before\n");
      await expect(stat(join(rootDir, "created.txt"))).rejects.toThrow();
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("revert asks for approval and leaves files unchanged when cancelled", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeSampleSnapshotLog(rootDir);
      const { writeFile } = await import("node:fs/promises");
      await writeFile(join(rootDir, "notes.txt"), "after\n");
      await writeFile(join(rootDir, "created.txt"), "created\n");

      await buildProgram({
        cwd: rootDir,
        revertApprovalPrompter: async () => false,
      }).parseAsync(["revert", "snapshot-001"], { from: "user" });

      expect(stripAnsiLines(logs)).toContain("Snapshot revert plan");
      expect(logs.some((line) => line.includes("Would restore notes.txt"))).toBe(true);
      expect(logs.some((line) => line.includes("Revert cancelled."))).toBe(true);
      expect(await readFile(join(rootDir, "notes.txt"), "utf8")).toBe("after\n");
      expect(await readFile(join(rootDir, "created.txt"), "utf8")).toBe("created\n");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("revert does not apply in non-interactive mode", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeSampleSnapshotLog(rootDir);
      const { writeFile } = await import("node:fs/promises");
      await writeFile(join(rootDir, "notes.txt"), "after\n");
      await writeFile(join(rootDir, "created.txt"), "created\n");

      await buildProgram({ cwd: rootDir }).parseAsync(["revert", "snapshot-001"], {
        from: "user",
      });

      expect(stripAnsiLines(logs)).toContain("Snapshot revert plan");
      expect(
        logs.some((line) =>
          line.includes("Run from an interactive terminal to approve the revert."),
        ),
      ).toBe(true);
      expect(logs.some((line) => line.includes("Revert cancelled."))).toBe(true);
      expect(await readFile(join(rootDir, "notes.txt"), "utf8")).toBe("after\n");
      expect(await readFile(join(rootDir, "created.txt"), "utf8")).toBe("created\n");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});

async function writeSampleSnapshotLog(rootDir: string): Promise<void> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const snapshotDir = join(rootDir, ".ponyrace");
  await mkdir(join(snapshotDir, "files", "snapshot-001", "pre"), { recursive: true });
  await writeFile(join(snapshotDir, "files", "snapshot-001", "pre", "notes.txt"), "before\n");
  await writeFile(
    join(snapshotDir, "snapshots.jsonl"),
    `${[
      JSON.stringify({
        snapshot_id: "snapshot-001",
        session_id: "session-alpha",
        phase: "pre",
        timestamp_utc: "2026-06-21T13:00:00Z",
        action: "edit note",
        purpose: "Exercise history",
        reason: "Test history tree",
        expected: "A note changes",
        verify: "Run tests",
        rollback: "Restore pre snapshot",
        instruction_context: {
          mode: "opt_in",
          captured_at: "2026-06-22T17:04:23Z",
          session_id_hash: "sha256:session",
          git: { branch: "main", commit: "abc123", dirty: true },
          files: [
            {
              path: "AGENTS.md",
              status: "captured",
              sha256: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              bytes: 12,
            },
            { path: "CLAUDE.md", status: "missing" },
          ],
          skills: [
            {
              name: "pony-trail",
              path: "bundled-skills/pony-trail/SKILL.md",
              status: "captured",
              version_or_sha256:
                "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            },
          ],
          warnings: [],
        },
        files: [
          {
            path: "notes.txt",
            exists: true,
            type: "file",
            stored_copy: "files/snapshot-001/pre/notes.txt",
          },
          {
            path: "created.txt",
            exists: false,
          },
        ],
      }),
      JSON.stringify({
        snapshot_id: "snapshot-001",
        session_id: "session-alpha",
        phase: "post",
        timestamp_utc: "2026-06-21T13:01:00Z",
        summary: "Updated note",
        checks: "bun test",
        result: "pass",
        files: [
          {
            path: "notes.txt",
            exists: true,
            type: "file",
            stored_copy: "files/snapshot-001/post/notes.txt",
          },
          {
            path: "created.txt",
            exists: true,
            type: "file",
          },
        ],
      }),
    ].join("\n")}\n`,
  );
}

function stripAnsi(value: string): string {
  return value.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g"), "");
}

function stripAnsiLines(values: string[]): string[] {
  return values.map(stripAnsi);
}
