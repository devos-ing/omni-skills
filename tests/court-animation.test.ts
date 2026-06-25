import { describe, expect, test } from "bun:test";
import { createCourtAnimator, printHorseRaceHeader, printRaceTrack } from "../src/court-animation";
import type { Manifest } from "../src/runtimes/ponytrail/manifest";
import type { RequirementCourtRound } from "../src/runtimes/ponytrail/requirement-court";

// Minimal manifest fixture with two voter bots.
function makeManifest(): Manifest {
  return {
    manifestVersion: "0.1",
    kind: "ai-work-runtime.ponytrail",
    metadata: { name: "test", description: "", owner: "human_owner" },
    runtime: { mode: "requirement_first", defaultLanguage: "en", workerAgents: [] },
    models: [{ id: "m1", provider: "test", name: "test-model" }],
    bots: [
      {
        id: "product_manager_bot",
        displayName: "PM Bot",
        role: "Product Manager",
        panel: "requirement_court",
        model: "m1",
        instruction: "focus on user value",
        votes: true,
      },
      {
        id: "engineer_bot",
        displayName: "Engineer Bot",
        role: "Engineer",
        panel: "requirement_court",
        model: "m1",
        instruction: "focus on feasibility",
        votes: true,
      },
    ],
    deliberation: {
      maxRounds: 3,
      decisionRule: {
        voterIds: ["product_manager_bot", "engineer_bot"],
        voters: 2,
        requiredApprovals: 2,
      },
    },
  } as unknown as Manifest;
}

function makeRound(round: number, approved: boolean): RequirementCourtRound {
  return {
    round,
    discussion: [
      {
        botId: "product_manager_bot",
        displayName: "PM Bot",
        role: "product",
        round,
        message: "looks good",
        visibleThinking: { focus: "", concern: "", recommendation: "" },
        line: "product_manager_bot: looks good",
        vote: "approve",
        confidence: 0.9,
        requiredChanges: [],
      },
      {
        botId: "engineer_bot",
        displayName: "Engineer Bot",
        role: "engineering",
        round,
        message: "feasible",
        visibleThinking: { focus: "", concern: "", recommendation: "" },
        line: "engineer_bot: feasible",
        vote: approved ? "approve" : "amend",
        confidence: 0.8,
        requiredChanges: approved ? [] : ["clarify scope"],
      },
    ],
    votes: [],
    verdict: {
      approved,
      approvals: approved ? 2 : 1,
      amendments: approved ? 0 : 1,
      rejections: 0,
      missingVoters: [],
      requiredChanges: [],
    },
  };
}

describe("court animation", () => {
  test("printHorseRaceHeader writes to stdout without throwing", () => {
    const written: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: unknown) => {
      written.push(String(chunk));
      return true;
    };

    try {
      printHorseRaceHeader(makeManifest());
      expect(written.length).toBeGreaterThan(0);
    } finally {
      process.stdout.write = origWrite;
    }
  });

  test("printRaceTrack logs nothing when rounds array is empty", () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(" "));
    try {
      printRaceTrack([], makeManifest());
      expect(logs.length).toBe(0);
    } finally {
      console.log = origLog;
    }
  });

  test("printRaceTrack renders approve and needs_changes rows", () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(" "));
    try {
      const round = makeRound(1, false);
      printRaceTrack([round], makeManifest());
      const combined = logs.join("\n");
      expect(combined).toContain("PM Bot");
      expect(combined).toContain("Engineer Bot");
      expect(combined).toContain("not yet");
    } finally {
      console.log = origLog;
    }
  });

  test("printRaceTrack shows approved verdict", () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(" "));
    try {
      printRaceTrack([makeRound(1, true)], makeManifest());
      expect(logs.join("\n")).toContain("approved");
    } finally {
      console.log = origLog;
    }
  });

  test("createCourtAnimator onRoundStart logs round header", async () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(" "));
    try {
      const animator = createCourtAnimator(makeManifest());
      await animator.onRoundStart(1, ["product_manager_bot", "engineer_bot"]);
      animator.stop();
      expect(logs.join("\n")).toContain("Round 1");
    } finally {
      console.log = origLog;
    }
  });

  test("createCourtAnimator onRoundComplete appends round to race track", async () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(" "));
    try {
      const animator = createCourtAnimator(makeManifest());
      await animator.onRoundComplete(makeRound(1, true));
      animator.stop();
      expect(logs.join("\n")).toContain("Race Track");
    } finally {
      console.log = origLog;
    }
  });

  test("createCourtAnimator stop clears gallop interval without error", () => {
    const animator = createCourtAnimator(makeManifest());
    expect(() => animator.stop()).not.toThrow();
    // Calling stop twice should also be safe.
    expect(() => animator.stop()).not.toThrow();
  });

  test("createCourtAnimator onPonyStart writes animation frames to stdout", async () => {
    const written: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: unknown) => {
      written.push(String(chunk));
      return true;
    };
    try {
      const animator = createCourtAnimator(makeManifest(), { minPonyMs: 0, frameMs: 100000 });
      // start the animation but stop immediately so the test doesn't wait
      const startPromise = animator.onPonyStart("engineer_bot", "Engineer Bot", 1);
      animator.stop();
      await startPromise;
      expect(written.length).toBeGreaterThan(0);
    } finally {
      process.stdout.write = origWrite;
    }
  });

  test("createCourtAnimator onPonyComplete clears animation and writes result", async () => {
    const written: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: unknown) => {
      written.push(String(chunk));
      return true;
    };
    try {
      // minPonyMs:0 so onPonyComplete returns immediately without waiting
      const animator = createCourtAnimator(makeManifest(), { minPonyMs: 0, frameMs: 100000 });
      await animator.onPonyStart("product_manager_bot", "PM Bot", 1);
      const round = makeRound(1, true);
      const entry = round.discussion[0] ?? round.discussion[1];
      if (!entry) throw new Error("test fixture has no discussion entries");

      await animator.onPonyComplete(entry);
      animator.stop();
      const combined = written.join("");
      // clearAnimArea writes CLEAR sequences and the result line
      expect(combined).toContain("\x1b[2K");
    } finally {
      process.stdout.write = origWrite;
    }
  });

  test("createCourtAnimator uses default thoughts for unknown bot ids", async () => {
    const written: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: unknown) => {
      written.push(String(chunk));
      return true;
    };
    try {
      const animator = createCourtAnimator(makeManifest(), { minPonyMs: 0, frameMs: 100000 });
      await animator.onPonyStart("unknown_bot", "Unknown Bot", 1);
      animator.stop();
      expect(written.join("")).toContain("Unknown Bot");
    } finally {
      process.stdout.write = origWrite;
    }
  });
});
