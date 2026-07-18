"use client";

import { Check, Circle, ExternalLink, Paperclip, RotateCcw, Send, Sparkles } from "lucide-react";
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  type OrchestrationCaseContent,
  type OrchestrationLaneContent,
  orchestrationCases,
} from "../lib/landing-content";
import {
  COMPLETE_PHASE,
  getInitialPhase,
  getLaneStatus,
  getNextPhase,
  type LaneStatus,
  type OrchestrationPhase,
} from "../lib/orchestration-demo";

const PHASE_DELAY = 720;

const phaseLabels: Record<OrchestrationPhase["kind"], string> = {
  clarify: "Clarifying your goal",
  approval: "Waiting for your approval",
  dispatch: "Starting selected roles",
  collecting: "Specialists are working",
  synthesizing: "Writing one combined response",
  verifying: "Checking the release gates",
  complete: "Verified result ready",
};

type InputMethod = "pointer" | "keyboard";

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reducedMotion;
}

function CaseTabs({
  cases,
  selectedIndex,
  onSelect,
}: {
  cases: readonly OrchestrationCaseContent[];
  selectedIndex: number;
  onSelect: (index: number, inputMethod: InputMethod) => void;
}) {
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);

  function selectAndFocus(index: number) {
    onSelect(index, "keyboard");
    tabsRef.current[index]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % cases.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + cases.length) % cases.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = cases.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    selectAndFocus(nextIndex);
  }

  return (
    <div role="tablist" aria-label="Conversation examples" className="demo-case-tabs">
      {cases.map((orchestrationCase, index) => (
        <button
          key={orchestrationCase.id}
          ref={(node) => {
            tabsRef.current[index] = node;
          }}
          id={`orchestration-tab-${orchestrationCase.id}`}
          type="button"
          role="tab"
          aria-selected={selectedIndex === index}
          aria-controls={`orchestration-panel-${orchestrationCase.id}`}
          tabIndex={selectedIndex === index ? 0 : -1}
          onClick={() => onSelect(index, "pointer")}
          onKeyDown={(event) => handleKeyDown(event, index)}
        >
          <span>{orchestrationCase.title}</span>
          <small>{orchestrationCase.teamSlug}</small>
        </button>
      ))}
    </div>
  );
}

function AssistantAvatar() {
  return (
    <span className="chat-avatar chat-avatar-assistant" aria-hidden="true">
      <Sparkles size={15} />
    </span>
  );
}

function StatusMark({ status }: { status: LaneStatus }) {
  return status === "complete" ? (
    <Check size={14} aria-hidden="true" />
  ) : (
    <Circle size={11} aria-hidden="true" />
  );
}

function ChatToolRow({ lane, status }: { lane: OrchestrationLaneContent; status: LaneStatus }) {
  return (
    <article className="orchestration-lane chat-tool-row" data-status={status}>
      <span className="chat-tool-status">
        <StatusMark status={status} />
      </span>
      <span className="chat-tool-copy">
        <strong>{lane.label}</strong>
        <small>
          {status === "complete"
            ? lane.result
            : status === "active"
              ? lane.activity[0]
              : `${lane.owner} queued`}
        </small>
      </span>
      <a
        href={lane.sourceUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={`View ${lane.skill} skill source`}
      >
        ${lane.skill} <ExternalLink size={11} />
      </a>
    </article>
  );
}

function ApprovalCard({ phase }: { phase: OrchestrationPhase }) {
  const approved = !["clarify", "approval"].includes(phase.kind);
  return (
    <div className="chat-approval" data-approved={approved}>
      <span className="chat-approval-icon">
        {approved ? <Check size={15} /> : <Circle size={12} />}
      </span>
      <span>
        <strong>{approved ? "Scope approved" : "Approval required"}</strong>
        <small>
          {approved
            ? "The coordinator can launch the selected roles."
            : "Confirm the brief and smallest safe role set before work begins."}
        </small>
      </span>
      <span className="chat-approval-state">{approved ? "Approved" : "Review"}</span>
    </div>
  );
}

function AssistantMessage({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className={`chat-message chat-assistant-message${muted ? " is-muted" : ""}`}>
      <AssistantAvatar />
      <div className="chat-message-body">{children}</div>
    </div>
  );
}

export function WorkflowRunDemo() {
  const reducedMotion = usePrefersReducedMotion();
  const [selectedCaseIndex, setSelectedCaseIndex] = useState(0);
  const [phase, setPhase] = useState<OrchestrationPhase>(() => getInitialPhase(reducedMotion));
  const [hasEnteredViewport, setHasEnteredViewport] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);
  const [inputMethod, setInputMethod] = useState<InputMethod>("pointer");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workbenchRef = useRef<HTMLDivElement>(null);
  const activeCase = orchestrationCases[selectedCaseIndex] ?? orchestrationCases[0];

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const restart = useCallback(() => {
    clearTimer();
    setInputMethod("pointer");
    setHasEnteredViewport(true);
    setPhase(getInitialPhase(reducedMotion));
  }, [clearTimer, reducedMotion]);

  const selectCase = useCallback(
    (index: number, nextInputMethod: InputMethod) => {
      clearTimer();
      setInputMethod(nextInputMethod);
      setSelectedCaseIndex(index);
      setHasEnteredViewport(true);
      setPhase(getInitialPhase(reducedMotion));
    },
    [clearTimer, reducedMotion],
  );

  useEffect(() => {
    if (!reducedMotion) return;
    clearTimer();
    setHasEnteredViewport(true);
    setPhase(COMPLETE_PHASE);
  }, [clearTimer, reducedMotion]);

  useEffect(() => {
    const workbench = workbenchRef.current;
    if (!workbench || reducedMotion) return;
    if (!("IntersectionObserver" in window)) {
      setPhase(COMPLETE_PHASE);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setHasEnteredViewport(true);
        observer.disconnect();
      },
      { rootMargin: "0px 0px -35% 0px", threshold: 0 },
    );
    observer.observe(workbench);
    return () => observer.disconnect();
  }, [reducedMotion]);

  useEffect(() => {
    const updateVisibility = () => setIsDocumentVisible(document.visibilityState === "visible");
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    clearTimer();
    if (
      !activeCase ||
      !hasEnteredViewport ||
      !isDocumentVisible ||
      reducedMotion ||
      phase.kind === "complete"
    ) {
      return undefined;
    }
    timerRef.current = setTimeout(() => {
      setPhase((current) =>
        getNextPhase(current, {
          parallelLaneCount: activeCase.parallelLanes.length,
          gatedLaneCount: activeCase.gatedLanes.length,
        }),
      );
    }, PHASE_DELAY);
    return clearTimer;
  }, [activeCase, clearTimer, hasEnteredViewport, isDocumentVisible, phase, reducedMotion]);

  if (!activeCase) return null;

  const coordinatorStatus: LaneStatus = ["clarify", "approval"].includes(phase.kind)
    ? "active"
    : "complete";
  const resultReady = phase.kind === "complete";

  return (
    <div ref={workbenchRef} className="motion-workbench">
      <CaseTabs
        cases={orchestrationCases}
        selectedIndex={selectedCaseIndex}
        onSelect={selectCase}
      />
      <section
        id={`orchestration-panel-${activeCase.id}`}
        role="tabpanel"
        aria-labelledby={`orchestration-tab-${activeCase.id}`}
        aria-label="Simulated agent conversation"
        className="agent-window chat-shell"
        data-input={inputMethod}
      >
        <header className="chat-header">
          <div className="chat-header-identity">
            <AssistantAvatar />
            <span>
              <strong>Startup Team</strong>
              <small>Simulated conversation · {activeCase.teamSlug}</small>
            </span>
          </div>
          <button type="button" onClick={restart} className="editorial-control chat-replay">
            <RotateCcw size={13} /> Replay
          </button>
        </header>

        <div className="chat-thread" role="log" aria-label="Simulated conversation messages">
          <div className="chat-message chat-user-message">
            <span className="chat-avatar chat-avatar-user" aria-hidden="true">
              You
            </span>
            <div className="chat-message-body">
              <p>{activeCase.prompt}</p>
            </div>
          </div>

          <AssistantMessage>
            <p>
              I’ll turn this into one approved milestone plan, then start only the roles needed to
              ship it safely.
            </p>
            <ApprovalCard phase={phase} />
          </AssistantMessage>

          <AssistantMessage muted={phase.kind === "clarify"}>
            <p className="chat-message-intro">I’m coordinating the work now.</p>
            <div className="chat-tool-stack">
              <ChatToolRow lane={activeCase.coordinator} status={coordinatorStatus} />
              {activeCase.parallelLanes.map((lane, index) => (
                <ChatToolRow key={lane.skill} lane={lane} status={getLaneStatus(phase, index)} />
              ))}
              {activeCase.gatedLanes.map((lane, index) => {
                const status: LaneStatus =
                  phase.kind === "complete"
                    ? "complete"
                    : phase.kind === "verifying" && index <= phase.completedGateCount
                      ? index < phase.completedGateCount
                        ? "complete"
                        : "active"
                      : "queued";
                return <ChatToolRow key={lane.skill} lane={lane} status={status} />;
              })}
            </div>
          </AssistantMessage>

          <AssistantMessage muted={!resultReady}>
            <div className="chat-result" data-ready={resultReady}>
              <span>
                <Check size={15} /> Verified result
              </span>
              <p>
                {resultReady
                  ? activeCase.outcome
                  : "The final response will appear after the verification gates complete."}
              </p>
            </div>
          </AssistantMessage>
        </div>

        <footer className="chat-footer">
          <span aria-live="polite" className="chat-phase-status">
            {phaseLabels[phase.kind]}
          </span>
          <fieldset className="chat-composer" aria-label="Example message composer">
            <Paperclip size={16} aria-hidden="true" />
            <span>Ask Startup Team a follow-up…</span>
            <button type="button" disabled aria-label="Send example message">
              <Send size={15} />
            </button>
          </fieldset>
          <p>{activeCase.previewLabel}</p>
        </footer>
      </section>
    </div>
  );
}
