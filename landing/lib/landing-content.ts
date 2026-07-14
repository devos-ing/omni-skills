export interface WorkflowSkill {
  name: string;
  description: string;
}

export interface WorkflowDiagramStep {
  label: string;
  skill: string;
  description: string;
}

interface CatalogEntryBase {
  slug: string;
  name: string;
  description: string;
  entrySkill: string;
  localSkillNames: string[];
  avatarSeed: string;
  tag: string;
  accent: string;
  sourceUrl: string;
  skillSourceUrls?: Record<string, string>;
  installCommand: string;
  skills: WorkflowSkill[];
  diagramSteps: WorkflowDiagramStep[];
}

export interface TeamRoleContent {
  name: string;
  skill: string;
  description: string;
}

export interface WorkflowCardContent extends CatalogEntryBase {
  kind: "workflow";
}

export interface TeamCardContent extends CatalogEntryBase {
  kind: "team";
  coordinator: TeamRoleContent;
  members: TeamRoleContent[];
}

export type CatalogEntryContent = TeamCardContent | WorkflowCardContent;

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

export const githubUrl = "https://github.com/devos-ing/omni-skills";

export function getSkillSourceUrl(workflow: CatalogEntryContent, skill: string) {
  const explicitSource = workflow.skillSourceUrls?.[skill];
  if (explicitSource) return explicitSource;
  if (!workflow.localSkillNames.includes(skill)) return null;
  return `${workflow.sourceUrl.replace("/tree/", "/blob/")}/skills/${skill}/SKILL.md`;
}

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

export const startupTeam: TeamCardContent = {
  kind: "team",
  slug: "startup-team",
  name: "Startup Team",
  description:
    "Move one startup goal from direction to delivery with a coordinator that brings in strategy, product, design, engineering, and QA only when the work needs them.",
  entrySkill: "startup-goal",
  coordinator: {
    name: "Startup Goal",
    skill: "startup-goal",
    description: "Clarifies the brief, selects the needed roles, and combines their outputs.",
  },
  members: [
    { name: "CEO", skill: "ceo", description: "Company direction and tradeoffs" },
    { name: "CTO", skill: "cto", description: "Architecture and technical risk" },
    {
      name: "Product Manager",
      skill: "product-manager",
      description: "Discovery, PRDs, and issue slicing",
    },
    {
      name: "Web Design",
      skill: "web-design",
      description: "Interface direction and motion quality",
    },
    {
      name: "Engineering Manager",
      skill: "engineering-manager",
      description: "Delivery sequencing and quality gates",
    },
    {
      name: "Founding Engineer",
      skill: "founding-engineer",
      description: "Implementation framing and handoff",
    },
    {
      name: "QA Lead",
      skill: "qa-lead",
      description: "Acceptance checks and release risk",
    },
  ],
  localSkillNames: ["startup-goal"],
  avatarSeed: "sha256:e2445fdfee4ef3d0a8aae8333a820a8485338bd1f62674c2596be49dba878f5f",
  tag: "Team",
  accent: "text-[#c83c24]",
  sourceUrl: `${githubUrl}/tree/main/examples/teams/startup-team`,
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
  installCommand: "npx omniskill@latest install startup-team",
  skills: [
    { name: "startup-goal", description: "Coordinate role subagents around one goal" },
    { name: "ceo", description: "Company direction and tradeoffs" },
    { name: "cto", description: "Architecture and technical risk" },
    { name: "product-manager", description: "Discovery, PRDs, and issue slicing" },
    { name: "web-design", description: "Interface direction and motion quality" },
    { name: "engineering-manager", description: "Delivery sequencing and quality gates" },
    { name: "founding-engineer", description: "Implementation framing and handoff" },
    { name: "qa-lead", description: "Acceptance checks and release risk" },
    { name: "emilkowalski:emil-design-eng", description: "Polish interface implementation" },
    {
      name: "emilkowalski:animation-vocabulary",
      description: "Name and select motion patterns",
    },
    { name: "emilkowalski:apple-design", description: "Apply Apple design principles" },
    { name: "emilkowalski:review-animations", description: "Review motion quality" },
    { name: "superpowers:brainstorming", description: "Explore options before scope locks" },
    { name: "superpowers:writing-plans", description: "Create executable plans" },
    {
      name: "superpowers:verification-before-completion",
      description: "Verify before claiming done",
    },
    { name: "mattpocock:wayfinder", description: "Map decisions and uncertainty" },
    { name: "mattpocock:grill-with-docs", description: "Stress-test direction" },
    { name: "mattpocock:to-spec", description: "Write product requirements" },
    { name: "mattpocock:to-tickets", description: "Slice work into issues" },
    { name: "mattpocock:codebase-design", description: "Review codebase boundaries" },
    { name: "mattpocock:domain-modeling", description: "Name domain concepts" },
    { name: "mattpocock:tdd", description: "Build with tests where practical" },
    { name: "mattpocock:diagnosing-bugs", description: "Diagnose failures from evidence" },
    { name: "mattpocock:code-review", description: "Review behavior and risk" },
    { name: "mattpocock:implement", description: "Execute the implementation slice" },
  ],
  diagramSteps: [
    {
      label: "Route",
      skill: "startup-goal",
      description: "Dispatch the needed role subagents for the next decision.",
    },
    {
      label: "Strategy",
      skill: "ceo",
      description: "Clarify company direction and tradeoffs.",
    },
    {
      label: "Product",
      skill: "product-manager",
      description: "Shape customer value, PRD, and issue slices.",
    },
    {
      label: "Design",
      skill: "web-design",
      description: "Set responsive interface direction and motion quality.",
    },
    {
      label: "Technology",
      skill: "cto",
      description: "Set architecture and technical risk boundaries.",
    },
    {
      label: "Delivery",
      skill: "engineering-manager",
      description: "Sequence execution and quality gates.",
    },
    {
      label: "Implementation frame",
      skill: "founding-engineer",
      description: "Prepare the smallest correct implementation slice.",
    },
    {
      label: "Implement",
      skill: "mattpocock:implement",
      description: "Execute the planned change with tests and review.",
    },
    {
      label: "QA",
      skill: "qa-lead",
      description: "Check release readiness and residual risk.",
    },
  ],
};

export const featuredTeamSectionContent = {
  eyebrow: "Omniskills Teams",
  heading: "Pick an Omniskills team",
  lead: "Start with a coordinated team when one role is not enough. One install gives your agent a coordinator, specialist roles, and the playbooks that connect them.",
  featuredLabel: "Featured team",
  copyInstallLabel: "Copy Startup Team install command",
  viewTeamLabel: "View team",
  viewTeamSourceLabel: "View team source",
  coordinatorLabel: "Coordinator",
  membersLabel: "Members",
} as const;

export const skillHubSectionContent = {
  eyebrow: "Skill Hub",
  heading: "Explore the Skill Hub",
  lead: "Browse independently installable workflows or inspect the skills they assemble.",
  catalogLabel: "Skill Hub catalog",
  clearAction: "Clear search",
  noResultsPrefix: "No",
  matchLabel: "match",
  tabs: {
    workflows: {
      label: "Workflows",
      searchLabel: "Search workflows",
      placeholder: "Search workflows, entry skills, or tags...",
      clearLabel: "Clear workflow search",
      noun: "workflow",
      nounPlural: "workflows",
    },
    skills: {
      label: "Skills",
      searchLabel: "Search skills",
      placeholder: "Search skills, providers, or packages...",
      clearLabel: "Clear skill search",
      noun: "skill",
      nounPlural: "skills",
    },
  },
} as const;

export const workflows: WorkflowCardContent[] = [
  {
    kind: "workflow",
    slug: "ceo",
    name: "CEO",
    description:
      "Founder-level strategy for direction, hard tradeoffs, fundraising/customer framing, and company decisions.",
    entrySkill: "ceo",
    localSkillNames: ["ceo"],
    avatarSeed: "sha256:e28e960ca32f944aad4353c9248e43ca7526a5f4451d1293cd79590878f2b25a",
    tag: "Strategy",
    accent: "text-[#c83c24]",
    sourceUrl: `${githubUrl}/tree/main/examples/workflows/ceo`,
    installCommand: "npx omniskill@latest install ceo",
    skills: [
      { name: "ceo", description: "Set the executive frame" },
      { name: "mattpocock:wayfinder", description: "Map strategic uncertainty" },
      { name: "mattpocock:grill-with-docs", description: "Stress-test the company direction" },
    ],
    diagramSteps: [
      {
        label: "Brief",
        skill: "ceo",
        description: "State the company-level decision.",
      },
      {
        label: "Decision Map",
        skill: "mattpocock:wayfinder",
        description: "Map options, constraints, and uncertainties.",
      },
      {
        label: "Grill",
        skill: "mattpocock:grill-with-docs",
        description: "Stress-test the direction before committing.",
      },
    ],
  },
  {
    kind: "workflow",
    slug: "cto",
    name: "CTO",
    description:
      "Technical leadership for architecture, domain model, platform direction, and engineering risk.",
    entrySkill: "cto",
    localSkillNames: ["cto"],
    avatarSeed: "sha256:644afba52d60f4bbcf9a608c6ead98688650e9fc3f8ed0a63ac0d30ca4931156",
    tag: "Architecture",
    accent: "text-[#c83c24]",
    sourceUrl: `${githubUrl}/tree/main/examples/workflows/cto`,
    installCommand: "npx omniskill@latest install cto",
    skills: [
      { name: "cto", description: "Set the technical frame" },
      { name: "mattpocock:codebase-design", description: "Review module boundaries" },
      { name: "mattpocock:domain-modeling", description: "Clarify domain concepts" },
      { name: "mattpocock:diagnosing-bugs", description: "Diagnose technical risk" },
      { name: "mattpocock:code-review", description: "Review behavior and risk" },
    ],
    diagramSteps: [
      {
        label: "Brief",
        skill: "cto",
        description: "Identify the technical trajectory decision.",
      },
      {
        label: "Domain",
        skill: "mattpocock:domain-modeling",
        description: "Name the business concepts before abstractions.",
      },
      {
        label: "Architecture",
        skill: "mattpocock:codebase-design",
        description: "Review boundaries and interfaces.",
      },
      {
        label: "Risk",
        skill: "mattpocock:diagnosing-bugs",
        description: "Diagnose failures and fragile assumptions.",
      },
      {
        label: "Review",
        skill: "mattpocock:code-review",
        description: "Check behavior, blast radius, and tradeoffs.",
      },
    ],
  },
  {
    kind: "workflow",
    slug: "product-manager",
    name: "Product Manager",
    description:
      "Product discovery, PRDs, acceptance criteria, roadmap tradeoffs, and issue slicing.",
    entrySkill: "product-manager",
    localSkillNames: ["product-manager"],
    avatarSeed: "sha256:c0c7094ce1e2d9c614bd9939d9a379f488d809b0316d568017f584263f1eab8f",
    tag: "Product",
    accent: "text-[#c83c24]",
    sourceUrl: `${githubUrl}/tree/main/examples/workflows/product-manager`,
    installCommand: "npx omniskill@latest install product-manager",
    skills: [
      { name: "product-manager", description: "Frame the product problem" },
      { name: "superpowers:brainstorming", description: "Explore product options" },
      { name: "mattpocock:to-spec", description: "Write the product specification" },
      { name: "mattpocock:to-tickets", description: "Slice delivery tickets" },
      { name: "superpowers:writing-plans", description: "Write the delivery plan" },
    ],
    diagramSteps: [
      {
        label: "Brief",
        skill: "product-manager",
        description: "Name the user, pain, and desired behavior change.",
      },
      {
        label: "Brainstorm",
        skill: "superpowers:brainstorming",
        description: "Explore product options before locking scope.",
      },
      {
        label: "PRD",
        skill: "mattpocock:to-spec",
        description: "Write the requirement and acceptance criteria.",
      },
      {
        label: "Issues",
        skill: "mattpocock:to-tickets",
        description: "Slice the PRD into visible progress.",
      },
      {
        label: "Plan",
        skill: "superpowers:writing-plans",
        description: "Turn scope into executable delivery steps.",
      },
    ],
  },
  {
    kind: "workflow",
    slug: "engineering-manager",
    name: "Engineering Manager",
    description:
      "Delivery sequencing, execution risk, quality gates, blocker triage, and engineering process.",
    entrySkill: "engineering-manager",
    localSkillNames: ["engineering-manager"],
    avatarSeed: "sha256:70d97c45ac61d3774317681dc7ae318126e14a3d0b19f00183d8227ca0fb1071",
    tag: "Delivery",
    accent: "text-[#c83c24]",
    sourceUrl: `${githubUrl}/tree/main/examples/workflows/engineering-manager`,
    installCommand: "npx omniskill@latest install engineering-manager",
    skills: [
      { name: "engineering-manager", description: "Set the delivery frame" },
      { name: "superpowers:writing-plans", description: "Write the execution plan" },
      { name: "mattpocock:tdd", description: "Choose the test strategy" },
      { name: "mattpocock:diagnosing-bugs", description: "Triage blockers" },
      { name: "mattpocock:code-review", description: "Review behavior and risk" },
    ],
    diagramSteps: [
      {
        label: "Brief",
        skill: "engineering-manager",
        description: "Identify the shippable outcome and delivery risk.",
      },
      {
        label: "Plan",
        skill: "superpowers:writing-plans",
        description: "Sequence work into verifiable steps.",
      },
      {
        label: "Quality",
        skill: "mattpocock:tdd",
        description: "Pick test gates by blast radius.",
      },
      {
        label: "Debug",
        skill: "mattpocock:diagnosing-bugs",
        description: "Triage blockers from evidence.",
      },
      {
        label: "Review",
        skill: "mattpocock:code-review",
        description: "Review delivery risk before handoff.",
      },
    ],
  },
  {
    kind: "workflow",
    slug: "founding-engineer",
    name: "Founding Engineer",
    description:
      "Implementation lane for the smallest correct change: tests, debugging, review, and verification.",
    entrySkill: "founding-engineer",
    localSkillNames: ["founding-engineer"],
    avatarSeed: "sha256:2c1ee7f8710c90004a958f81aa84321fad2efc83d8839fede97689f6ebf1b078",
    tag: "Build",
    accent: "text-[#c83c24]",
    sourceUrl: `${githubUrl}/tree/main/examples/workflows/founding-engineer`,
    installCommand: "npx omniskill@latest install founding-engineer",
    skills: [
      { name: "founding-engineer", description: "Set the implementation frame" },
      { name: "mattpocock:implement", description: "Implement the planned change" },
      { name: "mattpocock:tdd", description: "Use test-first development" },
      { name: "mattpocock:diagnosing-bugs", description: "Diagnose failures" },
      { name: "mattpocock:code-review", description: "Review behavior and risk" },
      { name: "superpowers:verification-before-completion", description: "Verify completion" },
    ],
    diagramSteps: [
      {
        label: "Brief",
        skill: "founding-engineer",
        description: "Read the plan and acceptance criteria.",
      },
      {
        label: "Implement",
        skill: "mattpocock:implement",
        description: "Ship the smallest correct slice.",
      },
      {
        label: "TDD",
        skill: "mattpocock:tdd",
        description: "Keep tests close to changed behavior.",
      },
      {
        label: "Debug",
        skill: "mattpocock:diagnosing-bugs",
        description: "Debug from evidence when checks fail.",
      },
      {
        label: "Review",
        skill: "mattpocock:code-review",
        description: "Review risks and behavior.",
      },
      {
        label: "Verify",
        skill: "superpowers:verification-before-completion",
        description: "Run final checks before handoff.",
      },
    ],
  },
  {
    kind: "workflow",
    slug: "qa-lead",
    name: "QA Lead",
    description:
      "Release-risk lens for acceptance checks, regression focus, reproduction gaps, and verification evidence.",
    entrySkill: "qa-lead",
    localSkillNames: ["qa-lead"],
    avatarSeed: "sha256:17b5f20fa744bdbc0791717b5705e8be940b7cbdfaf4d5604e9d6a6a19124a53",
    tag: "Quality",
    accent: "text-[#c83c24]",
    sourceUrl: `${githubUrl}/tree/main/examples/workflows/qa-lead`,
    installCommand: "npx omniskill@latest install qa-lead",
    skills: [
      { name: "qa-lead", description: "Set the release-risk frame" },
      { name: "mattpocock:code-review", description: "Review behavior and risk" },
      { name: "mattpocock:diagnosing-bugs", description: "Diagnose failures" },
      { name: "superpowers:verification-before-completion", description: "Verify before handoff" },
    ],
    diagramSteps: [
      {
        label: "Brief",
        skill: "qa-lead",
        description: "Restate the user-facing behavior that must be true.",
      },
      {
        label: "Review",
        skill: "mattpocock:code-review",
        description: "Review acceptance and release risk.",
      },
      {
        label: "Debug",
        skill: "mattpocock:diagnosing-bugs",
        description: "Identify reproduction gaps and failure evidence.",
      },
      {
        label: "Verify",
        skill: "superpowers:verification-before-completion",
        description: "Separate verified facts from residual risk.",
      },
    ],
  },
  {
    kind: "workflow",
    slug: "haaland",
    name: "Haaland",
    description:
      "A one-shot JTS meme workflow for a football-finisher caption, parody post concept, and original Haaland profile icon asset.",
    entrySkill: "haaland",
    localSkillNames: ["haaland"],
    avatarSeed: "sha256:d10bf16eca98054b3a23bbe0aac21ccb00e7f904c5f3b1c3480bb1009c575583",
    tag: "Meme",
    accent: "text-[#c83c24]",
    sourceUrl: `${githubUrl}/tree/main/examples/workflows/haaland`,
    installCommand: "npx omniskill@latest install haaland",
    skills: [{ name: "haaland", description: "Create one profile-icon meme concept" }],
    diagramSteps: [
      {
        label: "One Shot",
        skill: "haaland",
        description: "Create one caption and profile icon placement note.",
      },
    ],
  },
];

export const catalogEntries: CatalogEntryContent[] = [startupTeam, ...workflows];

export const commands: CommandExample[] = [
  {
    label: "Install Startup Team",
    command: "npx omniskill@latest install startup-team",
  },
  {
    label: "Inspect Startup Team deps",
    command: "npx omniskill@latest deps startup-team",
  },
  {
    label: "Lock skill fingerprints",
    command: "npx omniskill@latest lock examples/teams/startup-team",
  },
  {
    label: "Check loop status",
    command: "npx omniskill@latest loop status grilled-product-dev --latest --json",
  },
  {
    label: "Create your own workflow",
    command: "npx omniskill@latest init my-workflow",
  },
  {
    label: "Validate before sharing",
    command: "npx omniskill@latest validate my-workflow",
  },
  {
    label: "List installed Omniskills workflows",
    command: "npx omniskill@latest list",
  },
  {
    label: "Remove installed workflow",
    command: "npx omniskill@latest remove startup-team",
  },
];

export const howItWorks = [
  {
    title: "Install a many-skill bank",
    body: "A workflow manifest defines the callable entry skill plus every local or external specialist skill it needs.",
  },
  {
    title: "Call one entry skill with a goal",
    body: "Users invoke a single skill, such as $startup-goal, and the workflow routes the goal through the right roles.",
  },
  {
    title: "Compound specialist judgment",
    body: "Strategy, product, architecture, delivery, implementation, and QA roles stay aligned so the agent can 3x your ability without manual skill juggling. Looped workflows can track resumable, action-only workflow state through the CLI.",
  },
];
