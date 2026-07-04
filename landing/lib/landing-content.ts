export interface WorkflowSkill {
  name: string;
  description: string;
}

export interface WorkflowDiagramStep {
  label: string;
  skill: string;
  description: string;
}

export interface WorkflowCardContent {
  slug: string;
  name: string;
  description: string;
  entrySkill: string;
  tag: string;
  accent: string;
  sourceUrl: string;
  installCommand: string;
  skills: WorkflowSkill[];
  diagramSteps: WorkflowDiagramStep[];
}

export interface CommandExample {
  label: string;
  command: string;
}

export type AgentId = "claude" | "codex" | "cursor" | "opencode" | "github-copilot";

export interface AgentBadgeContent {
  id: AgentId;
  name: string;
  logoSrc?: string;
}

export const githubUrl = "https://github.com/0xroylee/getsuperpower";

export const agents: AgentBadgeContent[] = [
  { id: "claude", name: "Claude", logoSrc: "/agent-logos/claude.svg" },
  { id: "codex", name: "Codex", logoSrc: "/agent-logos/openai.svg" },
  { id: "cursor", name: "Cursor", logoSrc: "/agent-logos/cursor.svg" },
  { id: "opencode", name: "opencode" },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    logoSrc: "/agent-logos/github-copilot.svg",
  },
];

export const workflows: WorkflowCardContent[] = [
  {
    slug: "openspec-delivery",
    name: "OpenSpec Delivery",
    description:
      "A complete delivery lifecycle from proposal through design, TDD build, verification, and archive.",
    entrySkill: "openspec-delivery",
    tag: "Featured",
    accent: "text-violet-300",
    sourceUrl: `${githubUrl}/tree/main/examples/workflows/openspec-superpowers`,
    installCommand:
      "npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/openspec-superpowers'",
    skills: [
      { name: "opsx-propose", description: "Draft the scoped spec change" },
      {
        name: "brainstorming",
        description: "Explore viable design approaches",
      },
      {
        name: "writing-plans",
        description: "Create an executable implementation plan",
      },
      { name: "tdd-build", description: "Build task by task with tests first" },
      {
        name: "pony-trail",
        description: "Record verification and rollback context",
      },
    ],
    diagramSteps: [
      {
        label: "Proposal",
        skill: "opsx-handoff-review",
        description: "Create proposal, specs, and task handoff.",
      },
      {
        label: "Design",
        skill: "superpowers:brainstorming",
        description: "Explore approaches and get human approval.",
      },
      {
        label: "Plan",
        skill: "superpowers:writing-plans",
        description: "Split approved scope into executable tasks.",
      },
      {
        label: "Build",
        skill: "mattpocock:tdd",
        description: "Implement each slice with failing tests first.",
      },
      {
        label: "Evidence",
        skill: "pony-trail",
        description: "Record verification, rationale, and rollback context.",
      },
      {
        label: "Archive",
        skill: "opsx-handoff-review",
        description: "Update specs and project knowledge after delivery.",
      },
    ],
  },
  {
    slug: "release-review",
    name: "Release Review",
    description:
      "A lightweight workflow for shaping release risk, reviewing diffs, and preserving evidence.",
    entrySkill: "release-review",
    tag: "Starter",
    accent: "text-sky-300",
    sourceUrl: `${githubUrl}/tree/main/examples/workflows/release-review`,
    installCommand:
      "npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/release-review'",
    skills: [
      { name: "shape", description: "Clarify the release request" },
      { name: "release-risk-review", description: "Flag risk by surface area" },
      {
        name: "writing-plans",
        description: "Plan the release follow-through",
      },
      {
        name: "pony-trail",
        description: "Capture evidence and rollback notes",
      },
    ],
    diagramSteps: [
      {
        label: "Shape",
        skill: "shape",
        description: "Clarify the release goal and constraints.",
      },
      {
        label: "Risk Review",
        skill: "release-risk-review",
        description: "Review the diff for release risks.",
      },
      {
        label: "Plan",
        skill: "writing-plans",
        description: "Write concrete follow-through tasks.",
      },
      {
        label: "Evidence",
        skill: "pony-trail",
        description: "Preserve checks, rationale, and rollback notes.",
      },
    ],
  },
  {
    slug: "real-engineering",
    name: "Real Engineering",
    description:
      "Combines RTK, pony-trail, Superpowers, and Matt Pocock skills for TypeScript-heavy engineering.",
    entrySkill: "real-engineering",
    tag: "Advanced",
    accent: "text-amber-300",
    sourceUrl: `${githubUrl}/tree/main/examples/workflows/real-engineering`,
    installCommand:
      "npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/real-engineering'",
    skills: [
      { name: "rtk", description: "Token-efficient command execution" },
      {
        name: "mattpocock:tdd",
        description: "Focused red-green-refactor loops",
      },
      {
        name: "superpowers:verify",
        description: "Completion checks before delivery",
      },
      {
        name: "pony-trail",
        description: "Decision snapshots around file changes",
      },
    ],
    diagramSteps: [
      {
        label: "Run",
        skill: "rtk",
        description: "Use token-efficient commands for repo work.",
      },
      {
        label: "Test",
        skill: "mattpocock:tdd",
        description: "Drive behavior with focused tests.",
      },
      {
        label: "Verify",
        skill: "superpowers:verification-before-completion",
        description: "Check completion claims before handoff.",
      },
      {
        label: "Record",
        skill: "pony-trail",
        description: "Snapshot file-change intent and evidence.",
      },
    ],
  },
  {
    slug: "development-design-delivery",
    name: "Development Design Delivery",
    description:
      "Product-minded engineering from shape to interface design, plan, TDD, review, and evidence.",
    entrySkill: "development-design-delivery",
    tag: "Product",
    accent: "text-emerald-300",
    sourceUrl: `${githubUrl}/tree/main/examples/workflows/development-design-delivery`,
    installCommand:
      "npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/development-design-delivery'",
    skills: [
      { name: "brainstorming", description: "Shape the feature and constraints" },
      {
        name: "design-an-interface",
        description: "Explore interface directions",
      },
      { name: "writing-plans", description: "Split the work into small tasks" },
      { name: "tdd", description: "Build through public seams" },
      { name: "review", description: "Check behavior and risks" },
    ],
    diagramSteps: [
      {
        label: "Shape",
        skill: "brainstorming",
        description: "Clarify the product problem and constraints.",
      },
      {
        label: "Design",
        skill: "design-an-interface",
        description: "Explore interface directions before building.",
      },
      {
        label: "Plan",
        skill: "writing-plans",
        description: "Break the approved design into implementation tasks.",
      },
      {
        label: "Build",
        skill: "tdd",
        description: "Implement through public behavior seams.",
      },
      {
        label: "Review",
        skill: "review",
        description: "Check risks, behavior, and evidence.",
      },
    ],
  },
];

export const commands: CommandExample[] = [
  {
    label: "Install OpenSpec Delivery",
    command:
      "npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/openspec-superpowers'",
  },
  {
    label: "Install Release Review",
    command:
      "npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/release-review'",
  },
  {
    label: "List installed GetSuperpowers",
    command: "npx getsuperpower@latest list",
  },
  {
    label: "Create your own workflow",
    command: "npx getsuperpower@latest init my-workflow",
  },
  {
    label: "Validate before sharing",
    command: "npx getsuperpower@latest validate my-workflow",
  },
];

export const howItWorks = [
  {
    title: "workflow.json installs the skill tree",
    body: "A single manifest defines the callable entry skill and every local or external sub-skill it needs.",
  },
  {
    title: "The entry skill is the one command users call",
    body: "Users invoke a single skill, such as $openspec-delivery, and the workflow coordinates the rest.",
  },
  {
    title: "Sub-skills run in a deliberate order",
    body: "Proposal, design, planning, TDD, verification, and archive steps stay aligned without manual juggling.",
  },
];
