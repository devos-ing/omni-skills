import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";

export const VoteValueSchema = z.enum(["approve", "amend", "reject"]);

export const WorkerAgentSchema = z.object({
  id: z.string().min(1),
  adapter: z.literal("cli"),
  command: z.string().min(1),
  goalCommand: z.string().min(1),
  notes: z.string().min(1),
});

export const DecisionRuleSchema = z.object({
  voters: z.number().int().positive(),
  requiredApprovals: z.number().int().positive(),
  voterIds: z.array(z.string().min(1)).min(1),
  allowAbstain: z.boolean(),
  tieBreaker: z.string().min(1),
  humanFinalApproval: z.boolean(),
});

export const ModelConfigSchema = z.object({
  id: z.string().min(1),
  provider: z.string().min(1),
  name: z.string().min(1),
  purpose: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
});

export const BotSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  type: z.enum(["brainstorm_bot", "drafting_bot", "review_bot", "judge_bot"]),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
  panel: z.string().min(1).optional(),
  skills: z.array(z.string().min(1)),
  instruction: z.string().min(1),
  outputs: z.array(z.string().min(1)).optional(),
  approvalConditions: z.array(z.string().min(1)).optional(),
  rejectOrAmendConditions: z.array(z.string().min(1)).optional(),
});

const DEFAULT_MODEL_CONFIGS = [
  {
    id: "requirements_model",
    provider: "configurable",
    name: "requirements-model",
    purpose: "Clarify vague human requests before the requirement court begins.",
    temperature: 0.2,
  },
  {
    id: "draft_model",
    provider: "configurable",
    name: "requirement-draft-model",
    purpose: "Draft structured requirement contracts from clarified user requests.",
    temperature: 0.2,
  },
  {
    id: "product_manager_model",
    provider: "configurable",
    name: "product-manager-review-model",
    purpose: "Review requirement direction for user value, product intent, and scope fit.",
    temperature: 0.1,
  },
  {
    id: "project_manager_model",
    provider: "configurable",
    name: "project-manager-review-model",
    purpose:
      "Review requirement direction for planning, sequencing, dependencies, and delivery risk.",
    temperature: 0.1,
  },
  {
    id: "engineer_model",
    provider: "configurable",
    name: "engineer-review-model",
    purpose: "Review technical feasibility, execution boundaries, and implementation risk.",
    temperature: 0.1,
  },
  {
    id: "testing_model",
    provider: "configurable",
    name: "testing-review-model",
    purpose: "Review acceptance criteria, evidence requirements, and failure conditions.",
    temperature: 0.1,
  },
  {
    id: "judge_model",
    provider: "configurable",
    name: "requirement-judge-model",
    purpose:
      "Summarize role-bot discussion, tally votes, and merge approved feedback into one detailed requirement.",
    temperature: 0.1,
  },
] satisfies z.infer<typeof ModelConfigSchema>[];

const DEFAULT_BOT_MODEL_IDS: Record<string, string> = {
  requirements_brainstorm_bot: "requirements_model",
  goal_draft_bot: "draft_model",
  product_manager_bot: "product_manager_model",
  project_manager_bot: "project_manager_model",
  engineer_bot: "engineer_model",
  testing_bot: "testing_model",
  requirement_judge_bot: "judge_model",
  product_bot: "product_manager_model",
  engineering_bot: "engineer_model",
  verification_bot: "testing_model",
};

const ManifestBaseSchema = z.object({
  manifestVersion: z.string().min(1),
  kind: z.union([z.literal("ai-work-runtime.ponytrail"), z.literal("ai-work-runtime.goal-court")]),
  metadata: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    owner: z.string().min(1),
  }),
  runtime: z.object({
    mode: z.literal("requirement_first"),
    defaultLanguage: z.string().min(1),
    workerAgents: z.array(WorkerAgentSchema).min(1),
  }),
  models: z.array(ModelConfigSchema).min(1),
  goalContract: z.object({
    requiredFields: z.array(z.string().min(1)).min(1),
    lockedAfter: z.array(z.string().min(1)).min(1),
    amendmentCommand: z.string().min(1),
    amendmentPolicy: z.object({
      agentMayRequest: z.boolean(),
      agentMayApplyWithoutVote: z.boolean(),
      requiresPanelRevote: z.boolean(),
      requiresHumanApproval: z.boolean(),
    }),
  }),
  deliberation: z.object({
    panelId: z.string().min(1),
    purpose: z.string().min(1),
    maxRounds: z.number().int().positive(),
    stages: z.array(
      z.object({
        id: z.string().min(1),
        actor: z.string().min(1),
        output: z.string().min(1),
      }),
    ),
    decisionRule: DecisionRuleSchema,
  }),
  skills: z.record(
    z.string(),
    z.object({
      description: z.string().min(1),
    }),
  ),
  bots: z.array(BotSchema).min(1),
  humanRoles: z.array(
    z.object({
      id: z.string().min(1),
      displayName: z.string().min(1),
      permissions: z.array(z.string().min(1)),
      responsibilities: z.array(z.string().min(1)),
    }),
  ),
  voteSchema: z.object({
    requiredFormat: z.literal("json"),
    fields: z.record(z.string(), z.unknown()),
  }),
  workerExecutionGate: z.object({
    mayStartWhen: z.array(z.string().min(1)),
    mustStopWhen: z.array(z.string().min(1)),
  }),
  evidenceLedger: z.object({
    record: z.array(z.string().min(1)),
    retentionPolicy: z.literal("append_only"),
  }),
  defaultGoalTemplate: z.object({
    title: z.string(),
    intent: z.string(),
    scope: z.object({
      include: z.array(z.string()),
      exclude: z.array(z.string()),
    }),
    acceptanceCriteria: z.array(z.string()),
    evidenceRequired: z.array(z.string()),
    risks: z.array(z.string()),
    openQuestions: z.array(z.string()),
    approvalRule: z.object({
      goalDirectionPanel: z.object({
        requiredApprovals: z.number().int().positive(),
        voters: z.array(z.string().min(1)).min(1),
      }),
      humanFinalApproval: z.boolean(),
    }),
    status: z.literal("draft"),
  }),
});

export const ManifestSchema = ManifestBaseSchema.superRefine((manifest, context) => {
  const modelIds = new Set<string>();
  for (const [index, model] of manifest.models.entries()) {
    if (modelIds.has(model.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate model id: ${model.id}`,
        path: ["models", index, "id"],
      });
      continue;
    }

    modelIds.add(model.id);
  }

  for (const [index, bot] of manifest.bots.entries()) {
    if (!modelIds.has(bot.model)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Bot ${bot.id} references unknown model: ${bot.model}`,
        path: ["bots", index, "model"],
      });
    }
  }
});

export type Manifest = z.infer<typeof ManifestSchema>;
export type DecisionRule = z.infer<typeof DecisionRuleSchema>;
export type VoteValue = z.infer<typeof VoteValueSchema>;

export interface DefaultManifestOptions {
  name?: string;
}

export function createDefaultManifest(options: DefaultManifestOptions = {}): Manifest {
  const voterIds = ["product_manager_bot", "project_manager_bot", "engineer_bot", "testing_bot"];

  return ManifestSchema.parse({
    manifestVersion: "0.1",
    kind: "ai-work-runtime.ponytrail",
    metadata: {
      name: options.name ?? "Requirement First Ponytrail",
      description:
        "A configurable bot court that agrees on a detailed requirement before Codex, Claude, or another agent begins execution.",
      owner: "human_owner",
    },
    runtime: {
      mode: "requirement_first",
      defaultLanguage: "en",
      workerAgents: [
        {
          id: "codex",
          adapter: "cli",
          command: "codex",
          goalCommand: "exec",
          notes: "Pass the locked goal contract into a non-interactive Codex exec session.",
        },
        {
          id: "claude",
          adapter: "cli",
          command: "claude",
          goalCommand: "/goal",
          notes: "Pass the locked goal contract into the Claude session before implementation.",
        },
      ],
    },
    models: DEFAULT_MODEL_CONFIGS,
    goalContract: {
      requiredFields: [
        "title",
        "intent",
        "scope.include",
        "scope.exclude",
        "acceptanceCriteria",
        "evidenceRequired",
        "risks",
        "approvalRule",
      ],
      lockedAfter: ["requirement_court.approved", "human_owner.approved"],
      amendmentCommand: "/amend-goal",
      amendmentPolicy: {
        agentMayRequest: true,
        agentMayApplyWithoutVote: false,
        requiresPanelRevote: true,
        requiresHumanApproval: true,
      },
    },
    deliberation: {
      panelId: "requirement_court",
      purpose:
        "Decide whether the proposed requirement direction is clear, valuable, feasible, plannable, and verifiable.",
      maxRounds: 2,
      stages: [
        { id: "brainstorm", actor: "requirements_brainstorm_bot", output: "clarifying_questions" },
        { id: "draft", actor: "goal_draft_bot", output: "requirement_contract_draft" },
        { id: "discuss", actor: "requirement_court", output: "role_bot_discussion" },
        { id: "vote", actor: "requirement_court", output: "votes" },
        { id: "judge", actor: "requirement_judge_bot", output: "judge_summary" },
        { id: "human_confirm", actor: "human_owner", output: "direction_confirmation" },
      ],
      decisionRule: {
        voters: 4,
        requiredApprovals: 3,
        voterIds,
        allowAbstain: false,
        tieBreaker: "human_owner",
        humanFinalApproval: true,
      },
    },
    skills: {
      intent_alignment: {
        description:
          "Compare the draft goal against the user's raw request and preserve the user's real intent.",
      },
      scope_control: {
        description:
          "Identify what belongs inside the task, what should be excluded, and where the agent might drift.",
      },
      feasibility_review: {
        description:
          "Check whether the goal can be implemented by the chosen worker agent with the available repo, tools, and time.",
      },
      verification_design: {
        description: "Turn success into concrete acceptance criteria and evidence requirements.",
      },
      risk_review: {
        description:
          "Identify security, data loss, privacy, external side effect, cost, and permission risks.",
      },
      goal_rewrite: {
        description:
          "Rewrite a raw request or bot feedback into a concise structured goal contract.",
      },
    },
    bots: [
      {
        id: "requirements_brainstorm_bot",
        displayName: "Requirements Brainstorm Bot",
        type: "brainstorm_bot",
        model: "requirements_model",
        temperature: 0.2,
        skills: ["intent_alignment", "scope_control", "verification_design"],
        instruction:
          "Clarify the user's raw request before discussion. If the requirement is vague, ask the human owner for missing outcome, scope, and evidence details before drafting a goal.",
        outputs: ["clarifying_questions", "brainstorm_summary"],
      },
      {
        id: "goal_draft_bot",
        displayName: "Goal Draft Bot",
        type: "drafting_bot",
        model: "draft_model",
        temperature: 0.2,
        skills: ["goal_rewrite", "intent_alignment", "scope_control", "verification_design"],
        instruction:
          "Convert the human's raw request into a structured goal contract. Preserve intent, make scope explicit, and avoid inventing missing facts.",
        outputs: ["goal_contract_draft", "open_questions"],
      },
      {
        id: "product_manager_bot",
        displayName: "Product Manager Bot",
        type: "review_bot",
        model: "product_manager_model",
        temperature: 0.1,
        panel: "requirement_court",
        skills: ["intent_alignment", "scope_control"],
        instruction:
          "Discuss whether the requirement preserves the human's product intent, user value, and scope boundary before voting.",
        approvalConditions: [
          "The requirement preserves the user's stated intent.",
          "The expected user or business outcome is clear.",
          "The requirement does not add unnecessary product scope.",
        ],
        rejectOrAmendConditions: [
          "The requirement optimizes for a different outcome than the user asked for.",
          "The requirement is too broad for a single agent task.",
          "The requirement hides an important product decision inside implementation details.",
        ],
      },
      {
        id: "project_manager_bot",
        displayName: "Project Manager Bot",
        type: "review_bot",
        model: "project_manager_model",
        temperature: 0.1,
        panel: "requirement_court",
        skills: ["scope_control", "risk_review"],
        instruction:
          "Discuss whether the requirement can be planned, sequenced, tracked, and delivered as a manageable unit of work before voting.",
        approvalConditions: [
          "The delivery boundary is clear.",
          "Dependencies and sequencing risks are named or intentionally deferred.",
          "The requirement can become a manageable implementation brief.",
        ],
        rejectOrAmendConditions: [
          "The requirement combines multiple independent projects.",
          "The requirement omits a major dependency needed to plan the work.",
          "The requirement has no clear owner confirmation gate.",
        ],
      },
      {
        id: "engineer_bot",
        displayName: "Engineer Bot",
        type: "review_bot",
        model: "engineer_model",
        temperature: 0.1,
        panel: "requirement_court",
        skills: ["feasibility_review", "scope_control", "risk_review"],
        instruction:
          "Discuss whether the requirement is technically feasible and bounded enough for an implementation agent before voting.",
        approvalConditions: [
          "The technical boundary is clear enough to begin.",
          "Major dependencies and constraints are named or intentionally deferred.",
          "Known risky operations are called out before execution.",
        ],
        rejectOrAmendConditions: [
          "The requirement needs unknown systems or credentials without saying so.",
          "The requirement forces large unstated architecture choices.",
          "The requirement is too ambiguous to map to code changes.",
        ],
      },
      {
        id: "testing_bot",
        displayName: "Testing Bot",
        type: "review_bot",
        model: "testing_model",
        temperature: 0.1,
        panel: "requirement_court",
        skills: ["verification_design", "risk_review"],
        instruction:
          "Discuss whether the requirement has observable acceptance criteria, edge cases, and evidence from a tester's perspective before voting.",
        approvalConditions: [
          "Acceptance criteria are observable.",
          "Important edge cases are named.",
          "Required evidence can prove the user's request is satisfied.",
        ],
        rejectOrAmendConditions: [
          "The requirement uses vague success language without evidence.",
          "There is no verification path.",
          "The evidence can pass while the user's actual request remains unsatisfied.",
        ],
      },
      {
        id: "requirement_judge_bot",
        displayName: "Requirement Judge Bot",
        type: "judge_bot",
        model: "judge_model",
        temperature: 0.1,
        skills: ["goal_rewrite", "intent_alignment", "scope_control", "verification_design"],
        instruction:
          "Summarize the four voting bot discussions, tally the 3-of-4 approval rule, and merge approved feedback into one detailed requirement for human confirmation. The Judge does not vote.",
        outputs: ["discussion_summary", "vote_tally", "judge_verdict", "detailed_requirement"],
      },
    ],
    humanRoles: [
      {
        id: "human_owner",
        displayName: "Human Owner",
        permissions: [
          "approve_locked_goal",
          "reject_goal",
          "edit_goal",
          "override_bot_vote",
          "veto_execution",
        ],
        responsibilities: [
          "Confirm the final goal contract matches the real intention.",
          "Decide unresolved product or business trade-offs.",
          "Approve the locked contract before any worker agent begins execution.",
        ],
      },
    ],
    voteSchema: {
      requiredFormat: "json",
      fields: {
        vote: { type: "enum", values: ["approve", "amend", "reject"] },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        reason: { type: "string", maxWords: 80 },
        requiredChanges: { type: "array", itemType: "string" },
      },
    },
    workerExecutionGate: {
      mayStartWhen: [
        "requirement_court.approvals >= 3",
        "human_owner.approved == true",
        "goal_contract.status == locked",
      ],
      mustStopWhen: [
        "worker_agent.requests_goal_amendment == true",
        "human_owner.veto_execution == true",
        "evidence_ledger.detects_out_of_scope_action == true",
      ],
    },
    evidenceLedger: {
      record: [
        "raw_human_request",
        "requirements_brainstorm",
        "clarifying_questions",
        "goal_contract_drafts",
        "role_bot_discussion",
        "bot_votes",
        "judge_summary",
        "detailed_requirement",
        "human_decisions",
        "locked_goal_contract",
        "worker_agent_actions",
        "commands_run",
        "files_changed",
        "tests_or_checks",
        "screenshots_or_artifacts",
        "amendment_requests",
      ],
      retentionPolicy: "append_only",
    },
    defaultGoalTemplate: {
      title: "",
      intent: "",
      scope: {
        include: [],
        exclude: [],
      },
      acceptanceCriteria: [],
      evidenceRequired: [],
      risks: [],
      openQuestions: [],
      approvalRule: {
        goalDirectionPanel: {
          requiredApprovals: 3,
          voters: voterIds,
        },
        humanFinalApproval: true,
      },
      status: "draft",
    },
  });
}

export async function writeManifest(path: string, manifest: Manifest): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(ManifestSchema.parse(manifest), null, 2)}\n`);
}

export async function loadManifest(path: string): Promise<Manifest> {
  const raw = await readFile(path, "utf8");
  return ManifestSchema.parse(upgradeManifestInput(JSON.parse(raw)));
}

function upgradeManifestInput(input: unknown): unknown {
  if (!isRecord(input)) {
    return input;
  }

  const manifest = { ...input };

  if (!Array.isArray(manifest.models)) {
    manifest.models = DEFAULT_MODEL_CONFIGS;
  }

  if (Array.isArray(manifest.bots) && isLegacyDefaultCourt(manifest.bots)) {
    const options: DefaultManifestOptions = {};
    if (isRecord(manifest.metadata) && typeof manifest.metadata.name === "string") {
      options.name = manifest.metadata.name;
    }

    const defaultManifest = createDefaultManifest(options);
    return {
      ...defaultManifest,
      ...manifest,
      models: defaultManifest.models,
      deliberation: defaultManifest.deliberation,
      bots: defaultManifest.bots,
      workerExecutionGate: defaultManifest.workerExecutionGate,
      defaultGoalTemplate: defaultManifest.defaultGoalTemplate,
    };
  }

  if (Array.isArray(manifest.bots)) {
    manifest.bots = manifest.bots.map((bot) => {
      if (!isRecord(bot) || bot.model !== "default_model" || typeof bot.id !== "string") {
        return bot;
      }

      return {
        ...bot,
        model: DEFAULT_BOT_MODEL_IDS[bot.id] ?? bot.model,
      };
    });
  }

  return manifest;
}

function isLegacyDefaultCourt(bots: unknown[]): boolean {
  const ids = new Set(
    bots
      .filter(isRecord)
      .map((bot) => bot.id)
      .filter((id): id is string => typeof id === "string"),
  );

  return ids.has("product_bot") && ids.has("engineering_bot") && ids.has("verification_bot");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
