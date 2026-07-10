# Startup Goal Chat and Checkpoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the deterministic startup-goal landing demo so cases live on the left, all routed agents start together in chat, and five read-only workflow checkpoints appear on the right.

**Architecture:** Keep local case content and orchestration inside landing/components/workflow-run-demo.tsx. Replace sequential step state with one discriminated RunPhase, derive transcript and checkpoint views from that phase, and render the workbench through focused private case, chat, and checkpoint components.

**Tech Stack:** Bun, TypeScript, React, Next.js, Tailwind CSS, Lucide React, Bun test, Biome, OpenSpec.

---

## File map

- Modify openspec/specs/getsuperpower-landing/spec.md: public landing-demo behavior and acceptance scenarios.
- Modify tests/landing-app.test.ts: durable source-contract coverage for the three-region workbench and parallel run narrative.
- Modify landing/components/workflow-run-demo.tsx: local case model, run phase, timer transitions, chat, case rail, and checkpoint rail.
- Do not create a new runtime module or add a dependency; this remains one focused deterministic demo.

## Repository rules

- Run shell commands through rtk.
- Use apply_patch for every source mutation.
- Take the Pony Trail pre-snapshot shown in each mutation task before editing, then the matching post-snapshot immediately after its checks.
- Keep staging narrow. Do not stage ignored Pony Trail runtime records.
- Use the existing branch codex/startup-goal-chat-checkpoints.

### Task 1: Lock the new public contract and make the landing test fail

**Files:**
- Modify: openspec/specs/getsuperpower-landing/spec.md:9-57
- Modify: tests/landing-app.test.ts:334-430
- Reference: docs/superpowers/specs/2026-07-10-startup-goal-chat-checkpoints-design.md

- [ ] **Step 1: Record the contract-test pre-snapshot**

Run:

~~~~bash
rtk sh /Users/roy/.agents/skills/pony-trail/scripts/snapshot_change.sh --session-id startup-goal-chat-checkpoints-implementation --instruction-context pre --snapshot-id 20260710T090001Z-a11ce001 --files openspec/specs/getsuperpower-landing/spec.md tests/landing-app.test.ts --action edit --purpose "Lock the approved three-region startup-goal demo contract in the spec and focused landing test" --reason "The test must fail against the old two-column sequential demo before implementation begins" --expected "The OpenSpec scenario and source-contract assertions require cases left, chat agents together, and read-only checkpoints right" --verify "Run the focused landing test and confirm it fails on a new demo assertion" --rollback "Restore both files from the pre snapshot or revert their focused diff"
~~~~

Expected: JSON output with snapshot_id 20260710T090001Z-a11ce001.

- [ ] **Step 2: Replace the old workflow-run scenarios**

Use apply_patch to replace the workflow-run requirement through the duplicated
selected-skill scenarios with this contract:

~~~~markdown
### Requirement: Landing Page Shows A Workflow Run Demo

The landing page SHALL include a deterministic simulated workbench that shows
one startup-goal coordinator dispatching a parallel set of role agents.

#### Scenario: visitor watches the workflow run

- **WHEN** a visitor opens the landing page
- **THEN** the workbench shows selectable real startup cases in its left rail
- **AND** it keeps the Idea to v1, Pivot or focus, and Customer request cases
- **AND** the center chat completes intake, brief approval, and routing before
  showing every selected role agent as started working together
- **AND** role outputs return in deterministic order before a combined answer
- **AND** the right rail shows Intake, Brief approval, Route agents, Collect
  outputs, and Combined answer as read-only queued, active, or complete
  checkpoints
- **AND** the simulated workbench uses restrained neutral role styling with a
  single active accent
- **AND** the section appears before the workflow-card list

#### Scenario: visitor opens a role skill source

- **WHEN** a visitor clicks or keyboard-selects a coordinator or role badge in
  the chat
- **THEN** the badge opens the matching local SKILL.md source on GitHub
- **AND** the source link has a descriptive accessible name and safe external
  link attributes
- **AND** no case or checkpoint control duplicates the role agents

#### Scenario: visitor interprets the run demo

- **WHEN** a visitor reads the workflow-run section
- **THEN** the section identifies the displayed run as a simulation
- **AND** it does not imply the browser is executing a live agent workflow
- **AND** it reinforces intake, approval, parallel dispatch, output collection,
  and a combined next action

#### Scenario: visitor uses a narrow or reduced-motion display

- **WHEN** the viewport is below the desktop breakpoint
- **THEN** cases, chat, and checkpoints stack without horizontal scrolling
- **AND WHEN** reduced motion is preferred
- **THEN** the selected case renders directly in its completed state without
  timer-driven typewriter or entry animation
~~~~

Keep the local-static-content requirement beginning at the current line 59.

- [ ] **Step 3: Replace the old source-contract assertions**

Replace the test named renders an interactive simulated workflow run section
with the following test. Keep the next supported-agent test unchanged.

~~~~typescript
test("renders a parallel startup-goal chat with case and checkpoint rails", () => {
  const demo = readLandingFile("components/workflow-run-demo.tsx");
  const page = readLandingFile("components/landing-page.tsx");

  expect(demo).toContain("export function WorkflowRunDemo");
  expect(demo).toContain("const WORKFLOW_CASES");
  expect(demo).toContain("Idea to v1");
  expect(demo).toContain("Pivot or focus");
  expect(demo).toContain("Customer request");
  expect(demo).toContain(
    "/startup-goal I have an AI bookkeeping idea; help me choose the wedge and ship a v1 in two weeks",
  );
  expect(demo).toContain(
    "/startup-goal activation is weak; should we rebuild onboarding, narrow ICP, or add concierge setup?",
  );
  expect(demo).toContain(
    "/startup-goal customers keep asking for team seats; turn that into a safe release plan",
  );
  expect(demo).toContain("interface WorkflowCase");
  expect(demo).toContain("coordinator: SkillStep");
  expect(demo).toContain("roles: SkillStep[]");
  expect(demo).toContain("type RunPhase =");
  expect(demo).toContain('kind: "collecting"; returnedRoleCount: number');
  expect(demo).toContain("const CHECKPOINTS");
  expect(demo).toContain("Brief approval");
  expect(demo).toContain("Route agents");
  expect(demo).toContain("Collect outputs");
  expect(demo).toContain("Combined answer");
  expect(demo).toContain("CaseRail");
  expect(demo).toContain("ChatTranscript");
  expect(demo).toContain("CheckpointRail");
  expect(demo).toContain("started working");
  expect(demo).toContain("SkillSourceLink");
  expect(demo).toContain("getCheckpointStatus");
  expect(demo).toContain("getRoleStatus");
  expect(demo).toContain("aria-live=\"polite\"");
  expect(demo).toContain("aria-pressed={isSelected}");
  expect(demo).toContain('target="_blank"');
  expect(demo).toContain('rel="noreferrer"');
  expect(demo).toContain("lg:grid-cols-[13rem_minmax(0,1fr)_13rem]");
  expect(demo).toContain("sm:grid-cols-3");
  expect(demo).toContain("prefersReducedMotion ? \"auto\" : \"smooth\"");
  expect(demo).toContain("Replay");
  expect(demo).toContain("setTimeout");
  expect(demo).toContain("clearTimeout");
  expect(demo).not.toContain("Run calls");
  expect(demo).not.toContain("Selected skill");
  expect(demo).not.toContain("selectedStepIndex");
  expect(demo).not.toContain("completedSteps");
  expect(demo).not.toContain("processPoints");
  expect(demo).not.toContain("selected-skill-preview");
  expect(demo).not.toContain("$openspec-delivery");
  expect(demo).not.toContain("installCount");
  expect(demo).not.toContain("displayMetrics");

  expect(page).toContain("Agent run demo");
  expect(page).toContain("See where startup-goal fits.");
  expect(page).toContain("Pick a real startup situation");
  expect(page).toContain("Landing simulation only");
  expect(page).toContain("No browser-side agent execution or fake telemetry");
  expect(page).toContain("[ok] CEO");
  expect(page).toContain("[ok] QA");

  const demoIndex = page.indexOf("<WorkflowRunDemo");
  const workflowsIndex = page.indexOf('id="workflows"');

  expect(page).toContain("import { WorkflowRunDemo }");
  expect(page).not.toContain("import { FlowDiagram }");
  expect(page).not.toContain("workflowRun");
  expect(demoIndex).toBeGreaterThan(-1);
  expect(workflowsIndex).toBeGreaterThan(-1);
  expect(demoIndex).toBeLessThan(workflowsIndex);
});
~~~~

- [ ] **Step 4: Run the focused test and verify red**

Run:

~~~~bash
rtk bun test tests/landing-app.test.ts
~~~~

Expected: FAIL in the renamed workflow-run test because the old component does
not contain coordinator: SkillStep, roles: SkillStep[], CaseRail, or the
three-column class.

- [ ] **Step 5: Record the expected-red post-snapshot**

Run:

~~~~bash
rtk sh /Users/roy/.agents/skills/pony-trail/scripts/snapshot_change.sh --session-id startup-goal-chat-checkpoints-implementation post --snapshot-id 20260710T090001Z-a11ce001 --files openspec/specs/getsuperpower-landing/spec.md tests/landing-app.test.ts --summary "Replaced the old external-case and selected-skill contract with the approved parallel chat and checkpoint contract" --checks "rtk bun test tests/landing-app.test.ts failed on the new component contract as expected" --result expected-fail
~~~~

Expected: JSON output for the matching snapshot. Do not commit the red state.

### Task 2: Implement the canonical phase model and three-region workbench

**Files:**
- Modify: landing/components/workflow-run-demo.tsx:20-899
- Modify: tests/landing-app.test.ts:334-430 only if Biome changes wrapping
- Modify: openspec/specs/getsuperpower-landing/spec.md:9-65 only if Biome changes wrapping

- [ ] **Step 1: Record the implementation pre-snapshot**

Run:

~~~~bash
rtk sh /Users/roy/.agents/skills/pony-trail/scripts/snapshot_change.sh --session-id startup-goal-chat-checkpoints-implementation --instruction-context pre --snapshot-id 20260710T090002Z-a11ce002 --files landing/components/workflow-run-demo.tsx tests/landing-app.test.ts openspec/specs/getsuperpower-landing/spec.md --action edit --purpose "Implement the approved parallel agent chat and read-only checkpoint demo" --reason "The focused source contract is red against the old sequential two-column component" --expected "The component uses one RunPhase and renders cases, chat, and checkpoints without duplicated agent sidebars" --verify "Format the three files, pass the focused landing test, and pass landing typecheck" --rollback "Restore the three files from the pre snapshot or revert the implementation commit"
~~~~

Expected: JSON output with snapshot_id 20260710T090002Z-a11ce002.

- [ ] **Step 2: Replace the case and phase types**

Delete ProcessPoint and TranscriptEntry. Change WorkflowCase and add the phase
and checkpoint types exactly as follows:

~~~~typescript
interface WorkflowCase {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  outcome: string;
  coordinator: SkillStep;
  roles: SkillStep[];
}

interface WorkflowCaseInput {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  outcome: string;
  steps: [SkillStep, ...SkillStep[]];
}

type RunPhase =
  | { kind: "typing"; charIndex: number }
  | { kind: "intake" }
  | { kind: "approval" }
  | { kind: "dispatch" }
  | { kind: "collecting"; returnedRoleCount: number }
  | { kind: "synthesizing" }
  | { kind: "complete" };

type CheckpointId =
  | "intake"
  | "approval"
  | "dispatch"
  | "collecting"
  | "complete";

interface Checkpoint {
  id: CheckpointId;
  label: string;
}

const CHECKPOINTS: readonly Checkpoint[] = [
  { id: "intake", label: "Intake" },
  { id: "approval", label: "Brief approval" },
  { id: "dispatch", label: "Route agents" },
  { id: "collecting", label: "Collect outputs" },
  { id: "complete", label: "Combined answer" },
];
~~~~

Add this boundary below makeStep:

~~~~typescript
function defineWorkflowCase(input: WorkflowCaseInput): WorkflowCase {
  const [coordinator, ...roles] = input.steps;
  return {
    id: input.id,
    title: input.title,
    subtitle: input.subtitle,
    prompt: input.prompt,
    outcome: input.outcome,
    coordinator,
    roles,
  };
}
~~~~

Wrap each of the three existing case objects in defineWorkflowCase. Delete the
processPoints blocks at current lines 139-144, 219-224, and 299-304. Keep every
prompt, makeStep call, response, and outcome unchanged. Close each case with
}), and declare the final array with satisfies readonly WorkflowCase[].

- [ ] **Step 3: Add pure status derivation**

Replace Phase, getDonePhase, getStepStatus, and makeTranscriptEntry with:

~~~~typescript
const TYPE_DELAY = 18;
const COORDINATOR_DELAY = 620;
const DISPATCH_DELAY = 720;
const ROLE_RETURN_DELAY = 720;
const SYNTHESIS_DELAY = 560;

function getInitialPhase(reducedMotion: boolean): RunPhase {
  return reducedMotion ? { kind: "complete" } : { kind: "typing", charIndex: 0 };
}

function getActiveCheckpointIndex(phase: RunPhase): number {
  switch (phase.kind) {
    case "typing":
      return -1;
    case "intake":
      return 0;
    case "approval":
      return 1;
    case "dispatch":
      return 2;
    case "collecting":
      return 3;
    case "synthesizing":
      return 4;
    case "complete":
      return CHECKPOINTS.length;
  }
}

function getCheckpointStatus(phase: RunPhase, checkpointIndex: number): StepStatus {
  const activeIndex = getActiveCheckpointIndex(phase);
  if (checkpointIndex < activeIndex) return "complete";
  if (checkpointIndex === activeIndex) return "active";
  return "queued";
}

function showRoleBatch(phase: RunPhase): boolean {
  return (
    phase.kind === "dispatch" ||
    phase.kind === "collecting" ||
    phase.kind === "synthesizing" ||
    phase.kind === "complete"
  );
}

function getReturnedRoleCount(phase: RunPhase, roleCount: number): number {
  if (phase.kind === "collecting") {
    return Math.min(phase.returnedRoleCount, roleCount);
  }
  if (phase.kind === "synthesizing" || phase.kind === "complete") {
    return roleCount;
  }
  return 0;
}

function getRoleStatus(phase: RunPhase, roleIndex: number): StepStatus {
  if (!showRoleBatch(phase)) return "queued";
  if (phase.kind === "dispatch") return "active";
  if (phase.kind === "collecting") {
    return roleIndex < phase.returnedRoleCount ? "complete" : "active";
  }
  return "complete";
}
~~~~

- [ ] **Step 4: Replace sequential timers with one transition effect**

Remove completedSteps, selectedStepIndex, visibleTranscript, and both old phase
effects. Keep one timerRef and use this state/reset/transition shape:

~~~~typescript
const [phase, setPhase] = useState<RunPhase>(() => getInitialPhase(prefersReducedMotion));
const scrollRef = useRef<HTMLDivElement>(null);
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const reset = useCallback(() => {
  if (timerRef.current) clearTimeout(timerRef.current);
  setPhase(getInitialPhase(prefersReducedMotion));
}, [prefersReducedMotion]);

const selectCase = (caseIndex: number) => {
  if (timerRef.current) clearTimeout(timerRef.current);
  setSelectedCaseIndex(caseIndex);
  setPhase(getInitialPhase(prefersReducedMotion));
};

useEffect(() => {
  if (!prefersReducedMotion) return;
  if (timerRef.current) clearTimeout(timerRef.current);
  setPhase({ kind: "complete" });
}, [prefersReducedMotion]);

useEffect(() => {
  if (prefersReducedMotion || phase.kind === "complete") return undefined;

  const schedule = (nextPhase: RunPhase, delay: number) => {
    timerRef.current = setTimeout(() => setPhase(nextPhase), delay);
  };

  switch (phase.kind) {
    case "typing":
      if (phase.charIndex < activeCase.prompt.length) {
        schedule({ kind: "typing", charIndex: phase.charIndex + 1 }, TYPE_DELAY);
      } else {
        schedule({ kind: "intake" }, COORDINATOR_DELAY);
      }
      break;
    case "intake":
      schedule({ kind: "approval" }, COORDINATOR_DELAY);
      break;
    case "approval":
      schedule({ kind: "dispatch" }, COORDINATOR_DELAY);
      break;
    case "dispatch":
      schedule({ kind: "collecting", returnedRoleCount: 0 }, DISPATCH_DELAY);
      break;
    case "collecting":
      if (phase.returnedRoleCount < activeCase.roles.length) {
        schedule(
          { kind: "collecting", returnedRoleCount: phase.returnedRoleCount + 1 },
          ROLE_RETURN_DELAY,
        );
      } else {
        schedule({ kind: "synthesizing" }, SYNTHESIS_DELAY);
      }
      break;
    case "synthesizing":
      schedule({ kind: "complete" }, SYNTHESIS_DELAY);
      break;
  }

  return () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };
}, [activeCase.prompt, activeCase.roles.length, phase, prefersReducedMotion]);

useEffect(() => {
  scrollRef.current?.scrollTo({
    top: scrollRef.current.scrollHeight,
    behavior: prefersReducedMotion ? "auto" : "smooth",
  });
}, [phase, prefersReducedMotion]);
~~~~

- [ ] **Step 5: Add focused private render components**

Import type RefObject from React and remove useMemo from the React import.
Create SkillSourceLink, CaseRail, and CheckpointRail above WorkflowRunDemo.

~~~~tsx
function SkillSourceLink({ role }: { role: SkillStep }) {
  return (
    <a
      href={role.sourceUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={"Open " + role.skill + " skill source"}
      className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/20 px-1.5 py-0.5 font-mono text-[10px] text-white/48 transition hover:border-white/20 hover:text-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
    >
      {role.skill}
      <ExternalLink size={9} aria-hidden />
    </a>
  );
}

interface CaseRailProps {
  cases: readonly WorkflowCase[];
  selectedCaseIndex: number;
  onSelect: (caseIndex: number) => void;
}

function CaseRail({ cases, selectedCaseIndex, onSelect }: CaseRailProps) {
  return (
    <aside className="border-b border-white/[0.06] bg-white/[0.018] p-3 lg:overflow-y-auto lg:border-b-0">
      <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/25">Cases</p>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
        {cases.map((workflowCase, index) => {
          const isSelected = selectedCaseIndex === index;
          return (
            <button
              key={workflowCase.id}
              type="button"
              onClick={() => onSelect(index)}
              aria-pressed={isSelected}
              className={
                isSelected
                  ? "rounded-lg border border-violet-300/35 bg-violet-400/10 px-3 py-2.5 text-left text-white/86 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
                  : "rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2.5 text-left text-white/45 transition hover:border-white/16 hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
              }
            >
              <span className="block text-xs font-medium">{workflowCase.title}</span>
              <span className="mt-1 block text-[11px] leading-4 text-white/38">
                {workflowCase.subtitle}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function CheckpointRail({ phase }: { phase: RunPhase }) {
  return (
    <aside className="border-t border-white/[0.06] bg-white/[0.018] p-3 lg:overflow-y-auto lg:border-t-0">
      <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/25">
        Checkpoints
      </p>
      <ol className="grid gap-2 sm:grid-cols-5 lg:grid-cols-1">
        {CHECKPOINTS.map((checkpoint, index) => {
          const status = getCheckpointStatus(phase, index);
          return (
            <li
              key={checkpoint.id}
              data-status={status}
              className="rounded-lg border border-white/[0.08] bg-white/[0.025] px-2.5 py-2"
            >
              <span className="block text-[11px] font-medium text-white/68">
                {checkpoint.label}
              </span>
              <span className="mt-1 block text-[9px] uppercase tracking-[0.12em] text-white/34">
                {status}
              </span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
~~~~

- [ ] **Step 6: Build ChatTranscript around coordinator-first parallel dispatch**

Create ChatTranscript with these exact props and derived values:

~~~~tsx
interface ChatTranscriptProps {
  workflowCase: WorkflowCase;
  phase: RunPhase;
  scrollRef: RefObject<HTMLDivElement | null>;
  onReplay: () => void;
}

function ChatTranscript({
  workflowCase,
  phase,
  scrollRef,
  onReplay,
}: ChatTranscriptProps) {
  const isTyping = phase.kind === "typing";
  const isDone = phase.kind === "complete";
  const typedPrompt = isTyping
    ? workflowCase.prompt.slice(0, phase.charIndex)
    : workflowCase.prompt;
  const coordinatorLineCount =
    phase.kind === "typing" ? 0 : phase.kind === "intake" ? 1 : phase.kind === "approval" ? 2 : 3;
  const coordinatorComplete =
    phase.kind === "dispatch" ||
    phase.kind === "collecting" ||
    phase.kind === "synthesizing" ||
    phase.kind === "complete";
  const returnedRoleCount = getReturnedRoleCount(phase, workflowCase.roles.length);
  const returnedRoles = workflowCase.roles.slice(0, returnedRoleCount);

  return (
    <section className="flex h-[34rem] min-w-0 flex-col border-y border-white/[0.06] lg:h-full lg:border-x lg:border-y-0">
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
        <span className="font-mono text-[11px] text-white/28">
          agent-workbench/startup-goal
        </span>
        <button
          type="button"
          onClick={onReplay}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-white/35 transition hover:border-white/20 hover:text-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
          aria-label="Replay startup goal demo"
          title="Replay"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      <div className="border-b border-white/[0.06] bg-white/[0.015] px-3 py-2.5">
        <span className="text-xs font-medium text-white/76">{workflowCase.title}</span>
        <span className="ml-2 text-xs text-white/38">{workflowCase.subtitle}</span>
      </div>

      <div
        ref={scrollRef}
        aria-live="polite"
        aria-atomic="false"
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4"
      >
        <div className="flex gap-2.5">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-white/50">
            <User size={13} />
          </span>
          <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
            <p className="mb-1 text-[11px] text-white/28">You</p>
            <p className="break-words font-mono text-xs leading-5 text-white/76">
              {typedPrompt}
              {isTyping ? (
                <span className="ml-0.5 inline-block h-3.5 w-1 motion-safe:animate-pulse bg-white/65 align-middle" />
              ) : null}
            </p>
          </div>
        </div>

        {phase.kind !== "typing" ? (
          <div className="flex gap-2.5 motion-safe:animate-[agent-message_360ms_ease-out_both]">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-violet-300/20 bg-violet-400/10 text-violet-200">
              <Split size={13} />
            </span>
            <div className="min-w-0 flex-1 rounded-lg border border-violet-300/15 bg-violet-400/[0.07] px-2.5 py-2">
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-violet-100/45">
                  {workflowCase.coordinator.owner}
                </span>
                <SkillSourceLink role={workflowCase.coordinator} />
              </div>
              <div className="space-y-1">
                {workflowCase.coordinator.lines.slice(0, coordinatorLineCount).map((line) => (
                  <p key={line} className="text-xs leading-5 text-white/52">
                    {line}
                  </p>
                ))}
              </div>
              {coordinatorComplete ? (
                <p className="mt-1.5 border-t border-white/[0.06] pt-1.5 text-xs leading-5 text-white/66">
                  {workflowCase.coordinator.response}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {showRoleBatch(phase) ? (
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.025] px-2.5 py-2 motion-safe:animate-[agent-message_360ms_ease-out_both]">
            <p className="mb-2 text-xs text-white/58">Role agents started working together</p>
            <div className="flex flex-wrap gap-1.5">
              {workflowCase.roles.map((role, index) => (
                <span key={role.skill} className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-black/20 px-1.5 py-1">
                  <SkillSourceLink role={role} />
                  <span className="text-[9px] uppercase tracking-[0.12em] text-white/34">
                    {getRoleStatus(phase, index)}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {returnedRoles.map((role) => {
          const Icon = role.icon;
          return (
            <div
              key={"returned-" + role.skill}
              className="flex gap-2.5 motion-safe:animate-[agent-message_360ms_ease-out_both]"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.035] text-white/48">
                <Icon size={13} />
              </span>
              <div className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.025] px-2.5 py-2">
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium text-white/64">{role.owner}</span>
                  <SkillSourceLink role={role} />
                  <span className="text-[10px] text-white/42">returned</span>
                </div>
                <p className="text-xs leading-5 text-white/66">{role.response}</p>
              </div>
            </div>
          );
        })}

        {phase.kind === "synthesizing" ? (
          <div className="rounded-lg border border-violet-300/16 bg-violet-400/[0.07] px-2.5 py-2 text-xs text-white/58">
            Combining role outputs into one owner-facing answer
          </div>
        ) : null}

        {isDone ? (
          <div className="flex gap-2.5 motion-safe:animate-[agent-message_360ms_ease-out_both]">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-violet-300/24 bg-violet-400/10 text-violet-100/82">
              <Sparkles size={13} />
            </span>
            <div className="min-w-0 flex-1 rounded-lg border border-violet-300/16 bg-violet-400/[0.07] px-2.5 py-2">
              <p className="mb-1 text-[11px] text-violet-100/45">Combined answer</p>
              <p className="text-xs leading-5 text-white/72">{workflowCase.outcome}</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-white/[0.06] bg-white/[0.018] p-2.5">
        <div className="rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-1.5 font-mono text-[11px] text-white/34">
          {isDone ? "approve next action or ask a role to revise" : "sub-agents streaming"}
        </div>
      </div>
    </section>
  );
}
~~~~

- [ ] **Step 7: Replace the old JSX with the three-region shell**

Remove the external Case categories row, run-calls rail, selected-skill
preview, process-point chips, and old transcript mapping. WorkflowRunDemo
returns:

~~~~tsx
return (
  <div id="workflow-run">
    <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#090909] shadow-2xl shadow-black/40 lg:h-[36rem]">
      <div className="grid lg:h-full lg:grid-cols-[13rem_minmax(0,1fr)_13rem] lg:overflow-hidden">
        <CaseRail
          cases={WORKFLOW_CASES}
          selectedCaseIndex={selectedCaseIndex}
          onSelect={selectCase}
        />
        <ChatTranscript
          workflowCase={activeCase}
          phase={phase}
          scrollRef={scrollRef}
          onReplay={reset}
        />
        <CheckpointRail phase={phase} />
      </div>
    </div>
  </div>
);
~~~~

- [ ] **Step 8: Format the focused files**

Run:

~~~~bash
rtk bunx biome format --write landing/components/workflow-run-demo.tsx tests/landing-app.test.ts openspec/specs/getsuperpower-landing/spec.md
~~~~

Expected: Biome formats only the three named files.

- [ ] **Step 9: Run the focused test and landing typecheck**

Run from the repository root:

~~~~bash
rtk bun test tests/landing-app.test.ts
~~~~

Then run from the landing directory:

~~~~bash
rtk bun run typecheck
~~~~

Expected: the focused test passes with 0 failures; Next type generation and
TypeScript complete with exit code 0.

- [ ] **Step 10: Record the green post-snapshot**

Run:

~~~~bash
rtk sh /Users/roy/.agents/skills/pony-trail/scripts/snapshot_change.sh --session-id startup-goal-chat-checkpoints-implementation post --snapshot-id 20260710T090002Z-a11ce002 --files landing/components/workflow-run-demo.tsx tests/landing-app.test.ts openspec/specs/getsuperpower-landing/spec.md --summary "Implemented the canonical RunPhase, parallel role launch chat, left case rail, and right read-only checkpoint rail" --checks "Focused landing test and landing typecheck passed after Biome formatting" --result pass
~~~~

Expected: JSON output for the matching snapshot.

- [ ] **Step 11: Commit the functional slice**

Run:

~~~~bash
rtk git add landing/components/workflow-run-demo.tsx tests/landing-app.test.ts openspec/specs/getsuperpower-landing/spec.md
rtk git diff --cached --name-only
rtk git diff --cached --check
rtk git commit -m "feat: show startup agents in demo chat"
~~~~

Expected: exactly the three named files are staged, the cached check prints no
errors, and the commit succeeds.

### Task 3: Verify responsive, reduced-motion, and repository behavior

**Files:**
- Verify: landing/components/workflow-run-demo.tsx
- Verify: tests/landing-app.test.ts
- Verify: openspec/specs/getsuperpower-landing/spec.md

- [ ] **Step 1: Run the focused and landing package gates**

Run from the repository root:

~~~~bash
rtk bun test tests/landing-app.test.ts
~~~~

Then run from the landing directory:

~~~~bash
rtk bun run check
~~~~

Expected: the focused test passes; landing tests, typecheck, and production
build all exit 0.

- [ ] **Step 2: Run the repository gate**

Run:

~~~~bash
rtk bun run check
~~~~

Expected: Biome, root TypeScript, test coverage, and the 90 percent line
coverage gate all pass.

- [ ] **Step 3: Start the landing app for browser acceptance**

Run in a persistent terminal from the landing directory:

~~~~bash
rtk bun run dev
~~~~

Expected: Next reports a local URL and the landing page returns HTTP 200.

- [ ] **Step 4: Verify the desktop narrative**

At a desktop viewport, inspect the demo from initial typing through completion:

- the three existing cases are in the left rail;
- chat is the center and checkpoints are the right rail;
- the coordinator completes intake, approval, and routing before role launch;
- all role skill badges appear in the same started-working message;
- no role result appears before that full launch group;
- role responses return in stable case order;
- the five read-only checkpoints stay synchronized;
- each skill link opens its matching SKILL.md source; and
- the combined answer appears last.

Expected: every item is visible and no agent list appears in either rail.

- [ ] **Step 5: Verify reset, accessibility, and narrow layout**

In the browser:

- switch cases during collection and confirm no prior-case response leaks;
- replay during typing, collection, and completion;
- keyboard through the three case buttons, Replay, and chat skill links;
- confirm checkpoints receive no focus;
- emulate reduced motion and confirm the completed state appears immediately;
- inspect a narrow viewport and confirm cases, chat, checkpoints stack in that
  order without horizontal scrolling.

Expected: no stale timers, duplicate returns, focus traps, clipped content, or
timer-driven reduced-motion animation.

- [ ] **Step 6: Confirm the final repository state**

Run:

~~~~bash
rtk git status --short --branch
rtk git log -3 --oneline --decorate
~~~~

Expected: the branch is codex/startup-goal-chat-checkpoints, the design and
implementation commits are present, and the worktree has no unintended
tracked changes.

## Final handoff

Report:

- the three modified implementation/spec files;
- the focused, landing, and full check results;
- the desktop, narrow, Replay, case-switch, keyboard, and reduced-motion
  browser evidence;
- any residual visual risk;
- the implementation commit hash; and
- whether the branch is ready to push or open as a pull request.
