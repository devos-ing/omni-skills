export interface WorkflowSkill {
  name: string;
  description: string;
}

export interface WorkflowDiagramStep {
  label: string;
  skill: string;
  description: string;
}

export interface WorkflowUsageExample {
  imageSrc: string;
  imageAlt: string;
  invocation: string;
  caption: string;
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
  usageExample?: WorkflowUsageExample;
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

export type OrchestrationLaneKind = "planning" | "implementation" | "verification";

export interface OrchestrationLaneContent {
  skill: string;
  label: string;
  owner: string;
  kind: OrchestrationLaneKind;
  activity: readonly string[];
  result: string;
  sourceUrl: string;
}

export interface OrchestrationCaseContent {
  id: string;
  teamSlug: "startup-team" | "finance-team" | "market-team";
  title: string;
  subtitle: string;
  previewLabel: "Example run · hardcoded preview";
  prompt: string;
  outcome: string;
  coordinator: OrchestrationLaneContent;
  parallelLanes: readonly OrchestrationLaneContent[];
  gatedLanes: readonly OrchestrationLaneContent[];
  installCommand: string;
}

export type AgentId =
  | "cursor"
  | "codex"
  | "claude"
  | "opencode"
  | "hermes"
  | "openclaw"
  | "github-copilot";

export interface AgentBadgeContent {
  id: AgentId;
  name: string;
  logoSrc?: string;
}

export type AudienceId = "solo-founders" | "developers" | "startup-teams";

export interface AudienceStoryContent {
  id: AudienceId;
  label: string;
  promise: string;
  outcomes: readonly [string, string, string];
}

export type CapabilityId =
  | "strategy"
  | "requirements"
  | "interface"
  | "architecture"
  | "verification"
  | "handoffs";

export interface CapabilityContent {
  id: CapabilityId;
  title: string;
  description: string;
}

export interface WhyFeatureContent {
  id: "goal" | "approvals" | "specialists" | "verification";
  label: string;
  title: string;
  description: string;
  evidence: readonly [string, string, string];
}

export interface FaqContent {
  question: string;
  answer: string;
}

export interface StartupStepContent {
  title: string;
  body: string;
}

export const githubUrl = "https://github.com/devos-ing/omni-skills";

export function getSkillSourceUrl(workflow: CatalogEntryContent, skill: string) {
  const explicitSource = workflow.skillSourceUrls?.[skill];
  if (explicitSource) return explicitSource;
  if (!workflow.localSkillNames.includes(skill)) return null;
  return `${workflow.sourceUrl.replace("/tree/", "/blob/")}/skills/${skill}/SKILL.md`;
}

export const agents: AgentBadgeContent[] = [
  { id: "cursor", name: "Cursor", logoSrc: "/agent-logos/cursor.svg" },
  { id: "codex", name: "Codex", logoSrc: "/agent-logos/openai.svg" },
  { id: "claude", name: "Claude", logoSrc: "/agent-logos/claude.svg" },
  { id: "opencode", name: "OpenCode" },
  { id: "hermes", name: "Hermes" },
  { id: "openclaw", name: "OpenClaw" },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    logoSrc: "/agent-logos/github-copilot.svg",
  },
];

export const startupLandingContent = {
  eyebrow: "Your startup's agent team",
  headline: "Build with a startup team of agents.",
  lead: "A coordinated skill set for solo founders, developers, and startup teams—from strategy and product thinking through implementation and QA.",
  installCommand: "npx omniskill@latest install startup-team",
  githubLabel: "View on GitHub",
  supportedAgentsLabel: "Supported Agents",
  compatibility:
    "Skills install across these agents. Host-managed internal role execution depends on the agent environment; public CLI dispatch is disabled.",
  showcase: {
    eyebrow: "Flagship showcase",
    heading: "One goal. The right specialists. Visible handoffs.",
    label: "Simulated run",
  },
} as const;

export type StartupLandingContent = typeof startupLandingContent;

export const audienceStories: readonly AudienceStoryContent[] = [
  {
    id: "solo-founders",
    label: "Solo Founders",
    promise: "Move from idea to shipped product without pretending every specialist is in-house.",
    outcomes: [
      "Pressure-test a product idea",
      "Turn decisions into an approval-ready build brief",
      "Ship with interface and QA checks",
    ],
  },
  {
    id: "developers",
    label: "Developers",
    promise: "Start implementation with clearer decisions and finish with stronger evidence.",
    outcomes: [
      "Convert a rough request into acceptance criteria",
      "Surface architecture and interface risks before editing",
      "Implement the approved slice and verify regressions",
    ],
  },
  {
    id: "startup-teams",
    label: "Startup Teams",
    promise: "Keep product, design, engineering, and QA aligned through visible handoffs.",
    outcomes: [
      "Establish one shared requirement brief",
      "Route only the specialists the work needs",
      "Record decisions, approvals, risks, and verification evidence",
    ],
  },
];

export const capabilities: readonly CapabilityContent[] = [
  {
    id: "strategy",
    title: "Strategy & validation",
    description: "Challenge assumptions and make a defensible direction decision.",
  },
  {
    id: "requirements",
    title: "Product requirements",
    description: "Produce clear scope, acceptance criteria, and approval-ready requirements.",
  },
  {
    id: "interface",
    title: "Interface design",
    description: "Shape responsive hierarchy, interaction, accessibility, and motion.",
  },
  {
    id: "architecture",
    title: "Architecture & implementation",
    description: "Expose technical risk and execute the approved build slice.",
  },
  {
    id: "verification",
    title: "QA & release verification",
    description: "Check acceptance, regressions, responsiveness, and release behavior.",
  },
  {
    id: "handoffs",
    title: "Approval gates & handoffs",
    description: "Keep decisions and accountable roles visible throughout the run.",
  },
];

export const whyFeatures: readonly WhyFeatureContent[] = [
  {
    id: "goal",
    label: "One coordinated goal",
    title: "Start with the outcome, not a maze of prompts.",
    description:
      "Startup Goal clarifies the request once, keeps the decision context together, and routes only the specialists the work needs.",
    evidence: ["One shared brief", "Smallest safe role set", "One combined response"],
  },
  {
    id: "approvals",
    label: "Two human gates",
    title: "You approve the plan and accept the feature.",
    description:
      "The milestone stops before implementation and again after QA and User Outcome Replay. Scope changes return to planning instead of becoming invisible assumptions.",
    evidence: ["Plan approved", "Feature accepted", "Scope changes explicit"],
  },
  {
    id: "specialists",
    label: "Specialist execution",
    title: "Bring in the right expertise at the right moment.",
    description:
      "Product, design, architecture, engineering, and QA skills work from the same brief with accountable handoffs between them.",
    evidence: ["Role-owned work", "Visible handoffs", "Parallel where safe"],
  },
  {
    id: "verification",
    label: "Verified result",
    title: "Finish with evidence, not an optimistic summary.",
    description:
      "The delivery loop checks acceptance, regressions, responsive behavior, and residual risk before the coordinator calls the goal complete.",
    evidence: ["Acceptance checked", "Regressions covered", "Residual risk named"],
  },
];

export const startupSteps: readonly StartupStepContent[] = [
  {
    title: "Install the team",
    body: "Copy one command into a supported agent environment.",
  },
  {
    title: "Call $startup-goal",
    body: "Describe the outcome; the coordinator clarifies until the brief is ready.",
  },
  {
    title: "Approve, verify, and accept",
    body: "Approve the implementation boundary, then review QA evidence and User Outcome Replay before feature acceptance.",
  },
];

export const faqItems: readonly FaqContent[] = [
  {
    question: "Does Startup Team replace my judgment?",
    answer:
      "No. You approve the milestone plan and feature acceptance. Any material scope change returns to planning.",
  },
  {
    question: "How are Startup Team installs and local research previews kept safe?",
    answer:
      "Startup Team carries a checked-in schema 0.2 lock with exact-commit external locators, and its declared members resolve from the same checkout. Managed refreshes require recorded ownership; mixed ownership fails closed. Finance Team and Market Team remain lockless local previews.",
  },
  {
    question: "Which CLI command installs a workflow or team?",
    answer:
      "Use install as the public install command. bundle and workflow remain compatibility aliases.",
  },
  {
    question: "Which agents are supported, and which features differ by agent?",
    answer:
      "Skills install into Cursor, Codex, Claude, OpenCode, Hermes, OpenClaw, and GitHub Copilot. Host-managed internal role execution requires an agent environment with internal subagent support; public CLI dispatch is disabled.",
  },
  {
    question: "Can I inspect every included skill?",
    answer:
      "Yes. Startup Team exposes its coordinator, member roles, workflow source, and local skill sources for inspection.",
  },
  {
    question: "Does every goal run every specialist role?",
    answer:
      "No. The coordinator selects the smallest safe role set and explains which roles were skipped and what would bring them back.",
  },
];

export const startupTeam: TeamCardContent = {
  kind: "team",
  slug: "startup-team",
  name: "Startup Team",
  description:
    "Move one approved startup feature at a time through plan approval, implementation, conditional rework, QA, User Outcome Replay, and human feature acceptance.",
  entrySkill: "startup-goal",
  coordinator: {
    name: "Startup Goal",
    skill: "startup-goal",
    description:
      "Controls the Goal Tunnel and Evidence Ledger, runs selected installed roles as internal subagents with bounded stage packets, and holds both human approval gates. Prepared, not executed is the fallback when the host launch capability or role profile is unavailable; public CLI dispatch stays disabled.",
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
    "setup-model-routing": `${githubUrl}/blob/main/examples/workflows/setup-model-routing/skills/setup-model-routing/SKILL.md`,
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
    { name: "superpowers:brainstorming", description: "Explore options before scope locks" },
    { name: "mattpocock:implement", description: "Execute the implementation slice" },
    { name: "setup-model-routing", description: "Configure global Codex model roles" },
  ],
  diagramSteps: [
    {
      label: "Prepare",
      skill: "startup-goal",
      description:
        "Define the Goal Tunnel, feature milestone, role inputs, and acceptance criteria.",
    },
    {
      label: "Plan",
      skill: "startup-goal",
      description: "Validate role outputs and the Evidence Ledger without prescribing methods.",
    },
    {
      label: "Plan approval",
      skill: "startup-goal",
      description: "Wait for explicit human approval of the implementation boundary.",
    },
    {
      label: "Implement",
      skill: "mattpocock:implement",
      description: "Execute only the approved milestone slice.",
    },
    {
      label: "Rework if needed",
      skill: "mattpocock:implement",
      description: "Make one bounded in-scope repair, then return fresh evidence to QA.",
    },
    {
      label: "Verify",
      skill: "qa-lead",
      description: "Record acceptance evidence, regressions, untested areas, and residual risk.",
    },
    {
      label: "User Outcome Replay",
      skill: "startup-goal",
      description: "Reconstruct expectations, needs, wishes, and journey after QA.",
    },
    {
      label: "Feature acceptance",
      skill: "startup-goal",
      description: "Wait for human acceptance before activating the next milestone.",
    },
  ],
};

export const financeTeam: TeamCardContent = {
  kind: "team",
  slug: "finance-team",
  name: "Finance Team",
  description:
    "Local preview: prepare manual company, financial, valuation, and risk handoffs, then combine completed outputs into one sourced public-company brief.",
  entrySkill: "finance-research",
  coordinator: {
    name: "Finance Research",
    skill: "finance-research",
    description: "Clarifies the decision, approves the source policy, and combines the research.",
  },
  members: [
    {
      name: "Company Analysis",
      skill: "company-analysis",
      description: "Business quality, competition, filings, claims, and events",
    },
    {
      name: "Financial Analysis",
      skill: "financial-analysis",
      description: "Revenue, margins, cash flow, balance sheet, and accounting signals",
    },
    {
      name: "Valuation Analysis",
      skill: "valuation-analysis",
      description: "Scenarios, sensitivity, catalysts, and expectation risk",
    },
    {
      name: "Risk Analysis",
      skill: "risk-analysis",
      description: "Contradictions, missing evidence, triggers, and invalidation",
    },
  ],
  localSkillNames: ["finance-research"],
  avatarSeed: "sha256:6f4d8968e485ea49b9130ba7fc1c85fd252e39d983a554ed9ea184d3606d71f5",
  tag: "Team",
  accent: "text-[#b06b22]",
  sourceUrl: `${githubUrl}/tree/main/examples/teams/finance-team`,
  skillSourceUrls: {
    "finance-research": `${githubUrl}/blob/main/examples/teams/finance-team/skills/finance-research/SKILL.md`,
    "company-analysis": `${githubUrl}/blob/main/examples/workflows/company-analysis/skills/company-analysis/SKILL.md`,
    "financial-analysis": `${githubUrl}/blob/main/examples/workflows/financial-analysis/skills/financial-analysis/SKILL.md`,
    "valuation-analysis": `${githubUrl}/blob/main/examples/workflows/valuation-analysis/skills/valuation-analysis/SKILL.md`,
    "risk-analysis": `${githubUrl}/blob/main/examples/workflows/risk-analysis/skills/risk-analysis/SKILL.md`,
    "setup-model-routing": `${githubUrl}/blob/main/examples/workflows/setup-model-routing/skills/setup-model-routing/SKILL.md`,
  },
  installCommand: "bun run dev -- install examples/teams/finance-team",
  skills: [
    { name: "finance-research", description: "Coordinate one approved company brief" },
    { name: "company-analysis", description: "Analyze the business and primary filings" },
    { name: "financial-analysis", description: "Analyze financial quality and trends" },
    { name: "valuation-analysis", description: "Build explicit valuation scenarios" },
    { name: "risk-analysis", description: "Challenge evidence and invalidation" },
    { name: "setup-model-routing", description: "Configure global Codex model roles" },
  ],
  diagramSteps: [
    {
      label: "Route",
      skill: "finance-research",
      description: "Approve the decision question, source policy, and selected specialists.",
    },
    {
      label: "Research",
      skill: "company-analysis",
      description: "Prepare user-controlled company, financial, and valuation handoffs.",
    },
    {
      label: "Challenge",
      skill: "risk-analysis",
      description: "Require completed manual risk review before the final brief.",
    },
  ],
};

export const marketTeam: TeamCardContent = {
  kind: "team",
  slug: "market-team",
  name: "Market Team",
  description:
    "Local preview: prepare manual macro, rates, structure, sector, and risk handoffs, then combine completed outputs into one sourced regime brief.",
  entrySkill: "market-research",
  coordinator: {
    name: "Market Research",
    skill: "market-research",
    description:
      "Clarifies the market question, approves evidence scope, and combines the regime view.",
  },
  members: [
    {
      name: "Macro Analysis",
      skill: "macro-analysis",
      description: "Growth, inflation, policy, liquidity, and the event calendar",
    },
    {
      name: "Rates Analysis",
      skill: "rates-analysis",
      description: "Yield curve, real rates, credit, and market transmission",
    },
    {
      name: "Market Structure",
      skill: "market-structure",
      description: "Breadth, volatility, concentration, and technical confirmation",
    },
    {
      name: "Sector Analysis",
      skill: "sector-analysis",
      description: "Leadership, rotation, relative strength, and policy sensitivity",
    },
    {
      name: "Risk Analysis",
      skill: "risk-analysis",
      description: "Contradictions, missing evidence, triggers, and invalidation",
    },
  ],
  localSkillNames: ["market-research"],
  avatarSeed: "sha256:710cf14423c75cb79b7c29fbdce171c8e740cfbe145695e0d69fc3e4a8d3854c",
  tag: "Team",
  accent: "text-[#287c73]",
  sourceUrl: `${githubUrl}/tree/main/examples/teams/market-team`,
  skillSourceUrls: {
    "market-research": `${githubUrl}/blob/main/examples/teams/market-team/skills/market-research/SKILL.md`,
    "macro-analysis": `${githubUrl}/blob/main/examples/workflows/macro-analysis/skills/macro-analysis/SKILL.md`,
    "rates-analysis": `${githubUrl}/blob/main/examples/workflows/rates-analysis/skills/rates-analysis/SKILL.md`,
    "market-structure": `${githubUrl}/blob/main/examples/workflows/market-structure/skills/market-structure/SKILL.md`,
    "sector-analysis": `${githubUrl}/blob/main/examples/workflows/sector-analysis/skills/sector-analysis/SKILL.md`,
    "risk-analysis": `${githubUrl}/blob/main/examples/workflows/risk-analysis/skills/risk-analysis/SKILL.md`,
    "setup-model-routing": `${githubUrl}/blob/main/examples/workflows/setup-model-routing/skills/setup-model-routing/SKILL.md`,
  },
  installCommand: "bun run dev -- install examples/teams/market-team",
  skills: [
    { name: "market-research", description: "Coordinate one approved regime brief" },
    { name: "macro-analysis", description: "Analyze the macro regime" },
    { name: "rates-analysis", description: "Analyze rates and credit transmission" },
    { name: "market-structure", description: "Analyze breadth and volatility" },
    { name: "sector-analysis", description: "Analyze leadership and rotation" },
    { name: "risk-analysis", description: "Challenge evidence and invalidation" },
    { name: "setup-model-routing", description: "Configure global Codex model roles" },
  ],
  diagramSteps: [
    {
      label: "Route",
      skill: "market-research",
      description: "Approve the market, horizon, evidence scope, and selected specialists.",
    },
    {
      label: "Research",
      skill: "macro-analysis",
      description: "Prepare user-controlled macro, rates, structure, and sector handoffs.",
    },
    {
      label: "Challenge",
      skill: "risk-analysis",
      description: "Require completed manual risk review before the final brief.",
    },
  ],
};

export const teams: TeamCardContent[] = [startupTeam, financeTeam, marketTeam];

function makeLane(
  input: Omit<OrchestrationLaneContent, "sourceUrl"> & { sourceUrl: string | undefined },
) {
  if (!input.sourceUrl) throw new Error(`Missing orchestration source URL for ${input.skill}`);
  return { ...input, sourceUrl: input.sourceUrl };
}

export const orchestrationCases: readonly OrchestrationCaseContent[] = [
  {
    id: "landing-page",
    teamSlug: "startup-team",
    title: "Build a landing page",
    subtitle: "Turn one product goal into a responsive, verified release.",
    previewLabel: "Example run · hardcoded preview",
    prompt: "Build an onboarding flow that gets a new user to first value in under two minutes.",
    outcome:
      "Implemented onboarding flow with responsive, keyboard, reduced-motion, and QA evidence.",
    installCommand: startupTeam.installCommand,
    coordinator: makeLane({
      skill: "startup-goal",
      label: "Route goal",
      owner: "Coordinator",
      kind: "planning",
      activity: [
        "Clarify audience and promise",
        "Present scope for approval",
        "Launch selected installed roles",
      ],
      result: "Approved route and role briefs ready.",
      sourceUrl: startupTeam.skillSourceUrls?.["startup-goal"],
    }),
    parallelLanes: [
      makeLane({
        skill: "product-manager",
        label: "Product scope",
        owner: "PM",
        kind: "planning",
        activity: ["Define visitor outcome", "Write acceptance criteria", "Cut unrelated scope"],
        result: "Page hierarchy and acceptance criteria ready.",
        sourceUrl: startupTeam.skillSourceUrls?.["product-manager"],
      }),
      makeLane({
        skill: "web-design",
        label: "Interface direction",
        owner: "Design",
        kind: "planning",
        activity: [
          "Set responsive hierarchy",
          "Define control-tower motion",
          "Review reduced-motion behavior",
        ],
        result: "Responsive visual and motion direction ready.",
        sourceUrl: startupTeam.skillSourceUrls?.["web-design"],
      }),
      makeLane({
        skill: "founding-engineer",
        label: "Implementation frame",
        owner: "Engineer",
        kind: "planning",
        activity: [
          "Map current components",
          "Define the smallest write slice",
          "Name tests and rollback",
        ],
        result: "Read-only implementation handoff ready.",
        sourceUrl: startupTeam.skillSourceUrls?.["founding-engineer"],
      }),
    ],
    gatedLanes: [
      makeLane({
        skill: "mattpocock:implement",
        label: "Implement",
        owner: "Implementer",
        kind: "implementation",
        activity: ["Write tests first", "Build the approved slice", "Run focused checks"],
        result: "Landing implementation and focused tests complete.",
        sourceUrl:
          "https://github.com/mattpocock/skills/blob/d574778f94cf620fcc8ce741584093bc650a61d3/skills/engineering/implement/SKILL.md",
      }),
      makeLane({
        skill: "qa-lead",
        label: "Verify",
        owner: "QA",
        kind: "verification",
        activity: [
          "Check acceptance",
          "Test responsive and keyboard states",
          "Report residual risk",
        ],
        result: "Release verification passed.",
        sourceUrl: startupTeam.skillSourceUrls?.["qa-lead"],
      }),
    ],
  },
  {
    id: "stock-research",
    teamSlug: "finance-team",
    title: "Research a stock",
    subtitle: "Build a sourced company thesis without inventing missing data.",
    previewLabel: "Example run · hardcoded preview",
    prompt:
      "$finance-research Research NVDA as a 12-month watchlist candidate using public sources.",
    outcome: "Sourced thesis, scenarios, catalysts, risks, and invalidation conditions ready.",
    installCommand: financeTeam.installCommand,
    coordinator: makeLane({
      skill: "finance-research",
      label: "Route research",
      owner: "Finance lead",
      kind: "planning",
      activity: [
        "Clarify ticker and horizon",
        "Approve source policy",
        "Prepare selected specialist handoffs",
      ],
      result: "Approved finance research route ready.",
      sourceUrl: financeTeam.skillSourceUrls?.["finance-research"],
    }),
    parallelLanes: [
      makeLane({
        skill: "company-analysis",
        label: "Company",
        owner: "Company analyst",
        kind: "planning",
        activity: [
          "Read primary filings",
          "Assess competitive position",
          "Separate claims from evidence",
        ],
        result: "Company evidence memo ready.",
        sourceUrl: financeTeam.skillSourceUrls?.["company-analysis"],
      }),
      makeLane({
        skill: "financial-analysis",
        label: "Financials",
        owner: "Financial analyst",
        kind: "planning",
        activity: [
          "Trace revenue and margins",
          "Review cash flow and balance sheet",
          "Flag accounting signals",
        ],
        result: "Financial-quality memo ready.",
        sourceUrl: financeTeam.skillSourceUrls?.["financial-analysis"],
      }),
      makeLane({
        skill: "valuation-analysis",
        label: "Valuation",
        owner: "Valuation analyst",
        kind: "planning",
        activity: [
          "Define scenario assumptions",
          "Test sensitivity",
          "Map catalysts and expectations",
        ],
        result: "Valuation scenarios ready.",
        sourceUrl: financeTeam.skillSourceUrls?.["valuation-analysis"],
      }),
    ],
    gatedLanes: [
      makeLane({
        skill: "risk-analysis",
        label: "Challenge thesis",
        owner: "Risk",
        kind: "verification",
        activity: [
          "Find contradictory evidence",
          "Audit missing sources",
          "Write invalidation conditions",
        ],
        result: "Risk and source verification complete.",
        sourceUrl: financeTeam.skillSourceUrls?.["risk-analysis"],
      }),
    ],
  },
  {
    id: "market-research",
    teamSlug: "market-team",
    title: "Research the market",
    subtitle: "Combine macro, rates, breadth, and leadership into one regime view.",
    previewLabel: "Example run · hardcoded preview",
    prompt:
      "$market-research Assess whether U.S. equities are risk-on or fragile using macro, rates, breadth, and sector leadership.",
    outcome: "Regime scenarios, probabilities, triggers, risks, and invalidation signals ready.",
    installCommand: marketTeam.installCommand,
    coordinator: makeLane({
      skill: "market-research",
      label: "Route research",
      owner: "Market lead",
      kind: "planning",
      activity: [
        "Clarify market and horizon",
        "Approve evidence scope",
        "Prepare selected specialist handoffs",
      ],
      result: "Approved market research route ready.",
      sourceUrl: marketTeam.skillSourceUrls?.["market-research"],
    }),
    parallelLanes: [
      makeLane({
        skill: "macro-analysis",
        label: "Macro",
        owner: "Macro analyst",
        kind: "planning",
        activity: [
          "Assess growth and inflation",
          "Review policy and liquidity",
          "Map the event calendar",
        ],
        result: "Macro regime memo ready.",
        sourceUrl: marketTeam.skillSourceUrls?.["macro-analysis"],
      }),
      makeLane({
        skill: "rates-analysis",
        label: "Rates",
        owner: "Rates analyst",
        kind: "planning",
        activity: ["Read the curve", "Assess real rates and credit", "Map market transmission"],
        result: "Rates and credit memo ready.",
        sourceUrl: marketTeam.skillSourceUrls?.["rates-analysis"],
      }),
      makeLane({
        skill: "market-structure",
        label: "Structure",
        owner: "Structure analyst",
        kind: "planning",
        activity: [
          "Measure breadth",
          "Review volatility and concentration",
          "Check technical confirmation",
        ],
        result: "Market-structure memo ready.",
        sourceUrl: marketTeam.skillSourceUrls?.["market-structure"],
      }),
      makeLane({
        skill: "sector-analysis",
        label: "Sectors",
        owner: "Sector analyst",
        kind: "planning",
        activity: ["Rank leadership", "Check rotation", "Map earnings and policy sensitivity"],
        result: "Sector-leadership memo ready.",
        sourceUrl: marketTeam.skillSourceUrls?.["sector-analysis"],
      }),
    ],
    gatedLanes: [
      makeLane({
        skill: "risk-analysis",
        label: "Challenge regime",
        owner: "Risk",
        kind: "verification",
        activity: [
          "Find contradictory signals",
          "Audit missing evidence",
          "Write triggers and invalidation",
        ],
        result: "Regime risk verification complete.",
        sourceUrl: marketTeam.skillSourceUrls?.["risk-analysis"],
      }),
    ],
  },
];

export const featuredTeamSectionContent = {
  eyebrow: "Omniskills Teams",
  heading: "Pick the team for the goal",
  lead: "Install a real coordinator and its specialist roles together. Startup Team ships product work; Finance Team researches public companies; Market Team builds a sourced regime view.",
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
      "Read-only implementation frame: identify seams, tests, failure evidence, review risk, and a handoff to a separate implementer.",
    entrySkill: "founding-engineer",
    localSkillNames: ["founding-engineer"],
    avatarSeed: "sha256:2c1ee7f8710c90004a958f81aa84321fad2efc83d8839fede97689f6ebf1b078",
    tag: "Plan",
    accent: "text-[#c83c24]",
    sourceUrl: `${githubUrl}/tree/main/examples/workflows/founding-engineer`,
    installCommand: "npx omniskill@latest install founding-engineer",
    skills: [
      { name: "founding-engineer", description: "Set the read-only implementation frame" },
      { name: "mattpocock:tdd", description: "Identify required test seams" },
      { name: "mattpocock:diagnosing-bugs", description: "Frame failure evidence" },
      { name: "mattpocock:code-review", description: "Identify behavior and review risk" },
      {
        name: "superpowers:verification-before-completion",
        description: "Define completion checks",
      },
    ],
    diagramSteps: [
      {
        label: "Brief",
        skill: "founding-engineer",
        description: "Read the plan and acceptance criteria.",
      },
      {
        label: "Tests",
        skill: "mattpocock:tdd",
        description: "Identify tests that keep evidence close to changed behavior.",
      },
      {
        label: "Diagnose",
        skill: "mattpocock:diagnosing-bugs",
        description: "Specify the evidence needed if checks fail.",
      },
      {
        label: "Review",
        skill: "mattpocock:code-review",
        description: "Identify risks and behavior to review.",
      },
      {
        label: "Checks",
        skill: "superpowers:verification-before-completion",
        description: "Define final checks for the implementation handoff.",
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
    slug: "codex-input-preview",
    name: "Codex Input Preview",
    description:
      "Turn a prompt, model label, and reasoning effort into a faithful 1200 × 675 simulated Codex composer PNG.",
    entrySkill: "codex-input-preview",
    localSkillNames: ["codex-input-preview"],
    avatarSeed: "sha256:badcaa276e46a5648ede65d2d0cb3429ca4dd81b0443420b9c72ad704d79a1bd",
    tag: "Workflow",
    accent: "text-[#5f5ce6]",
    sourceUrl: `${githubUrl}/tree/main/examples/workflows/codex-input-preview`,
    installCommand: "npx omniskill@latest install codex-input-preview",
    skills: [
      {
        name: "codex-input-preview",
        description: "Render one verified Codex composer PNG",
      },
    ],
    diagramSteps: [
      {
        label: "Render",
        skill: "codex-input-preview",
        description: "Fit the prompt, capture the composer, and verify exact PNG dimensions.",
      },
    ],
    usageExample: {
      imageSrc: "/examples/codex-input-preview.png",
      imageAlt:
        "Simulated Codex input showing “Help me announce that I’m joining the Codex team!” with GPT-5.6 and high effort.",
      invocation:
        "$codex-input-preview Draw “Help me announce that I’m joining the Codex team!” using GPT-5.6 with high effort.",
      caption: "Simulated Codex composer preview — not a live Codex session.",
    },
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

export const catalogEntries: CatalogEntryContent[] = [...teams, ...workflows];

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
    label: "Configure model routing",
    command: "npx omniskill@latest setup-model-routing",
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
    title: "Install a real team",
    body: "One Omniskills manifest installs a coordinator, specialist roles, and the source-linked playbooks that connect them.",
  },
  {
    title: "Give the coordinator one goal",
    body: "Call one entry skill. It clarifies scope, waits for approval, and routes only the roles the goal needs.",
  },
  {
    title: "Verify before feature acceptance",
    body: "Implementation and any bounded rework return evidence to QA, then User Outcome Replay checks the verified result before the final human gate.",
  },
];
