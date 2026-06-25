import pc from "picocolors";
import type { Manifest } from "./runtimes/ponytrail/manifest";
import type {
  RequirementCourtRound,
  RequirementDiscussionEntry,
} from "./runtimes/ponytrail/requirement-court";

// ─── Per-role colors ───────────────────────────────────────────────────────

const BOT_COLORS: Record<string, (s: string) => string> = {
  product_manager_bot: pc.magenta,
  project_manager_bot: pc.blue,
  engineer_bot: pc.cyan,
  senior_engineer_bot: pc.green,
  testing_bot: pc.yellow,
};

function botColor(botId: string): (s: string) => string {
  return BOT_COLORS[botId] ?? pc.white;
}

// ─── Small running pony (3 gallop frames, 5 lines each) ───────────────────

const COL_W = 10; // column width per pony in the lineup

// Shared head/body lines (same for all frames).
const PONY_HEAD = ["    ^     ", "   (o )~  ", "   (   )  "];

// Three leg positions for the gallop cycle.
const PONY_LEGS = [
  ["   /\\  /\\ ", "  /    \\/ "], // stride: legs spread
  ["    ||  || ", "    ||  || "], // trot: legs together
  ["   /\\  /\\ ", "  \\/    / "], // stride: reverse
];

// Total lines per animation frame (head + legs + label).
const FRAME_H = PONY_HEAD.length + 2 + 1; // 3 + 2 + 1 = 6

// ─── Header: starting lineup ───────────────────────────────────────────────

// Print all voter bots as a side-by-side row of colored ponies.
export function printHorseRaceHeader(manifest: Manifest): void {
  const voterIds = manifest.deliberation.decisionRule.voterIds;
  const bots = voterIds
    .map((id) => manifest.bots.find((b) => b.id === id))
    .filter((b): b is NonNullable<typeof b> => b !== undefined);

  console.log("");
  console.log(pc.bold(pc.cyan("  🏁  PONY COURT IS IN SESSION  🏁")));
  console.log(pc.dim("  ══════════════════════════════════"));
  console.log("");

  // Render head lines side-by-side.
  for (const headLine of PONY_HEAD) {
    const row = bots.map((b) => botColor(b.id)(headLine.padEnd(COL_W))).join("  ");
    process.stdout.write(`  ${row}\n`);
  }

  // Render a static "legs spread" frame for the lineup.
  const staticLegs = PONY_LEGS[0] ?? [];
  for (const legLine of staticLegs) {
    const row = bots.map((b) => botColor(b.id)(legLine.padEnd(COL_W))).join("  ");
    process.stdout.write(`  ${row}\n`);
  }

  // Names row below each pony.
  const names = bots
    .map((b) => {
      const name = (b.displayName ?? b.id).slice(0, COL_W - 1).padEnd(COL_W);
      return botColor(b.id)(name);
    })
    .join("  ");
  process.stdout.write(`  ${names}\n`);

  console.log("");
  console.log(pc.dim("  All ponies must vote before implementation begins."));
  console.log("");
}

// ─── Funny per-role thoughts ───────────────────────────────────────────────

const THOUGHTS: Record<string, string[]> = {
  product_manager_bot: [
    "is rewriting the roadmap on a hay bale...",
    "is aligning pony OKRs with the requirement...",
    "is questioning the user story over oats...",
  ],
  project_manager_bot: [
    "is updating the sprint board with a hoof...",
    "is calculating story points in horseshoes...",
    "is moving the ticket to 'In Deliberation'...",
  ],
  engineer_bot: [
    "is refactoring the horseshoe...",
    "is Googling 'how to implement in one sprint'...",
    "is checking if it breaks the stable CI...",
  ],
  senior_engineer_bot: [
    "is drawing system diagrams in the dirt...",
    "is raising concerns about technical debt...",
    "is insisting on a proper architecture review...",
  ],
  testing_bot: [
    "is writing edge cases for galloping...",
    "is asking 'but what if the carrot is null?'...",
    "is demanding a smoke test before approval...",
  ],
};

const DEFAULT_THOUGHTS = [
  "is deliberating very seriously...",
  "is consulting the hay oracle...",
  "is pondering the requirement...",
];

function thoughtsFor(botId: string): string[] {
  return THOUGHTS[botId] ?? DEFAULT_THOUGHTS;
}

// ─── ANSI helpers ──────────────────────────────────────────────────────────

const UP = (n: number) => `\x1b[${n}A`;
const CLEAR = "\x1b[2K";
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function drawFrame(frameIdx: number, colorFn: (s: string) => string, label: string): void {
  const legs = PONY_LEGS[frameIdx % PONY_LEGS.length] ?? PONY_LEGS[0] ?? [];
  const lines = [...PONY_HEAD, ...legs];
  for (const line of lines) {
    process.stdout.write(`${CLEAR}  ${colorFn(line)}\n`);
  }
  process.stdout.write(`${CLEAR}${label}\n`);
  process.stdout.write(UP(FRAME_H));
}

function clearAnimArea(resultLine: string): void {
  // Cursor is at TOP of animation area after last drawFrame.
  process.stdout.write(`${CLEAR}  ${resultLine}\n`);
  for (let i = 1; i < FRAME_H; i++) {
    process.stdout.write(`${CLEAR}\n`);
  }
  // Sit right after the result line.
  process.stdout.write(UP(FRAME_H - 1));
}

// ─── Race track ────────────────────────────────────────────────────────────

const VOTE_BARS: Record<string, string> = {
  approve: pc.green("████████"),
  amend: pc.yellow("████░░░░"),
  reject: pc.red("██░░░░░░"),
};

const VOTE_LABELS: Record<string, string> = {
  approve: pc.green("✓ approve"),
  amend: pc.yellow("~ amend"),
  reject: pc.red("✗ reject"),
};

export function printRaceTrack(rounds: RequirementCourtRound[], manifest: Manifest): void {
  if (rounds.length === 0) return;
  const latest = rounds.at(-1);
  if (!latest) return;

  console.log(pc.bold(`  ── Race Track  Round ${latest.round} ──`));
  for (const botId of manifest.deliberation.decisionRule.voterIds) {
    const entry = latest.discussion.find((d) => d.botId === botId);
    if (!entry) continue;
    const color = botColor(botId);
    const bar = VOTE_BARS[entry.vote] ?? pc.dim("░░░░░░░░");
    const label = VOTE_LABELS[entry.vote] ?? entry.vote;
    const name = color((entry.displayName ?? botId).padEnd(24));
    console.log(`  ${name} ${bar}  ${label}`);
  }
  const verdict = latest.verdict.approved
    ? pc.green("  Verdict: approved ✓")
    : pc.yellow(`  Verdict: not yet — ${latest.verdict.approvals} approval(s) so far`);
  console.log(verdict);
  console.log("");
}

// ─── Animator ──────────────────────────────────────────────────────────────

export interface CourtAnimatorOptions {
  /** Minimum ms to show each pony's animation before revealing the result. Default 1800. */
  minPonyMs?: number;
  /** Frame interval in ms for the gallop animation. Default 170. */
  frameMs?: number;
}

export interface CourtAnimator {
  onRoundStart(round: number, botIds: string[]): Promise<void>;
  onRoundComplete(round: RequirementCourtRound): Promise<void>;
  onPonyStart(botId: string, displayName: string, round: number): Promise<void>;
  onPonyComplete(entry: RequirementDiscussionEntry): Promise<void>;
  stop(): void;
}

export function createCourtAnimator(
  manifest: Manifest,
  options?: CourtAnimatorOptions,
): CourtAnimator {
  const minPonyMs = options?.minPonyMs ?? 1800;
  const frameMs = options?.frameMs ?? 170;
  const completedRounds: RequirementCourtRound[] = [];
  let gallopInterval: ReturnType<typeof setInterval> | undefined;
  let ponyStartTime = 0;
  let frameIndex = 0;
  let currentBotId = "";
  let currentDisplayName = "";
  let currentColorFn: (s: string) => string = pc.white;

  function clearGallop(): void {
    if (gallopInterval !== undefined) {
      clearInterval(gallopInterval);
      gallopInterval = undefined;
    }
  }

  return {
    async onRoundStart(round: number, botIds: string[]): Promise<void> {
      console.log(
        pc.bold(pc.cyan(`\n  🏁 Round ${round} — ${botIds.length} ponies enter the court\n`)),
      );
    },

    async onPonyStart(botId: string, displayName: string): Promise<void> {
      currentBotId = botId;
      currentDisplayName = displayName;
      currentColorFn = botColor(botId);
      ponyStartTime = Date.now();
      frameIndex = 0;

      process.stdout.write("\n".repeat(FRAME_H));
      process.stdout.write(UP(FRAME_H));

      const thoughts = thoughtsFor(botId);
      const label = `  ${currentColorFn("🐴")} ${displayName} ${thoughts[0] ?? ""}`;
      drawFrame(0, currentColorFn, label);

      gallopInterval = setInterval(() => {
        frameIndex++;
        const thought = thoughts[frameIndex % thoughts.length] ?? thoughts[0] ?? "";
        drawFrame(
          frameIndex,
          currentColorFn,
          `  ${currentColorFn("🐴")} ${currentDisplayName} ${thought}`,
        );
      }, frameMs);
    },

    async onPonyComplete(entry: RequirementDiscussionEntry): Promise<void> {
      const elapsed = Date.now() - ponyStartTime;
      if (elapsed < minPonyMs) await sleep(minPonyMs - elapsed);

      clearGallop();

      const color = botColor(currentBotId);
      const bar = VOTE_BARS[entry.vote] ?? pc.dim("░░░░░░░░");
      const voteLabel = VOTE_LABELS[entry.vote] ?? entry.vote;
      const name = pc.bold(color((entry.displayName ?? currentBotId).padEnd(24)));
      clearAnimArea(`${name} ${bar}  ${voteLabel}`);
    },

    async onRoundComplete(round: RequirementCourtRound): Promise<void> {
      completedRounds.push(round);
      console.log("");
      printRaceTrack(completedRounds, manifest);
    },

    stop(): void {
      clearGallop();
    },
  };
}
