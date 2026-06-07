# Session Subchannels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Slack-like `Chat` and `Task Info` subchannels under each session in the left sidebar, with `Task Info` rendered as a main-panel channel that reuses React Query cached task data.

**Architecture:** Add a shared chat-session subchannel route helper, then wire the operator shell, session pages, chat panel, and session sidebar through that helper. Keep data loading inside existing React Query hooks and render `Task Info` as a chatroom view instead of a side sheet.

**Tech Stack:** Next.js App Router, React, TypeScript, TanStack React Query, Tailwind, Bun test, Biome.

---

## Preparation

- Work in an isolated worktree or branch because the main checkout currently has unrelated staged adapter files and unrelated dirty web/CLI files.
- Before implementation edits, follow the root `AGENTS.md` sync rule: fetch `origin/main`, fast-forward local `main`, then create an implementation branch such as `codex/session-subchannels`.
- Read `packages/web/AGENTS.md` before web edits. Visible UI verification requires a browser pass after implementation.
- Do not stage, commit, or revert unrelated existing changes.

## File Map

- Create `packages/web/src/components/chat-room/chat-session-subchannels.ts`: shared subchannel type, labels, route builders, and route param normalizers.
- Create `packages/web/tests/chat-session-subchannels.test.ts`: pure helper coverage for subchannel normalization and URLs.
- Modify `packages/web/src/components/web-shell/operator-chat-sidebar-route.ts`: derive active subchannel from pathname while preserving existing active-session parsing.
- Modify `packages/web/tests/operator-chat-sidebar-route.test.ts`: route coverage for `/session/:id/chat`, `/session/:id/task-info`, and unknown channel fallback.
- Modify `packages/web/src/components/web-shell/web-operator-shell.tsx`: pass active subchannel into `OperatorChatSidebar`.
- Modify `packages/web/src/components/web-shell/operator-chat-sidebar.tsx`: route new sessions and session/subchannel clicks to durable subchannel URLs.
- Modify `packages/web/src/components/web-shell/types/operator-chat-sidebar.types.ts` and `operator-chat-sidebar-render-utils.ts`: add `activeSubchannel` to props and memo comparison.
- Modify `packages/web/src/app/(operator)/session/[sessionId]/page.tsx`: default old session route to `Chat`.
- Create `packages/web/src/app/(operator)/session/[sessionId]/[subchannel]/page.tsx`: durable subchannel route.
- Modify `packages/web/src/components/chat-room/types/chat-room.types.ts`: add `initialSubchannel` and `activeSubchannel` panel props, remove task-detail sheet props after the new channel exists.
- Modify `packages/web/src/components/chat-room/chat-room-panel.tsx`: hold active subchannel state and pass it to the view.
- Modify `packages/web/src/components/chat-room/chat-room-panel-view.tsx`: render either `ChatTranscript` or `ChatTaskInfoChannel`.
- Modify `packages/web/src/components/chat-room/chat-room-header.tsx`: remove the old Details button and show the active subchannel label.
- Delete `packages/web/src/components/chat-room/use-chat-task-detail-panel-state.ts` once the panel no longer imports it.
- Delete `packages/web/src/components/chat-room/chat-task-detail-sheet.tsx` after `ChatTaskInfoChannel` replaces the side-sheet surface.
- Modify `packages/web/src/components/chat-room/types/chat-room-sidebar.types.ts`: add subchannel props and row types.
- Modify `packages/web/src/components/chat-room/chat-room-sidebar.tsx`, `chat-room-session-list.tsx`, and `chat-room-session-row.tsx`: render selectable child rows under active sessions.
- Modify `packages/web/src/components/chat-room/chat-room-sidebar-utils.ts`: add pure subchannel-row helper.
- Modify `packages/web/tests/chat-room-sidebar-utils.test.ts`: verify child subchannel rows for active sessions.

## Task 1: Shared Subchannel Helpers

**Files:**
- Create: `packages/web/src/components/chat-room/chat-session-subchannels.ts`
- Create: `packages/web/tests/chat-session-subchannels.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `packages/web/tests/chat-session-subchannels.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";

import {
	DEFAULT_CHAT_SESSION_SUBCHANNEL,
	buildChatSessionHref,
	normalizeChatSessionSubchannel,
	readRouteParam,
} from "../src/components/chat-room/chat-session-subchannels";

describe("chat session subchannels", () => {
	it("defaults unknown route values to chat", () => {
		expect(DEFAULT_CHAT_SESSION_SUBCHANNEL).toBe("chat");
		expect(normalizeChatSessionSubchannel(undefined)).toBe("chat");
		expect(normalizeChatSessionSubchannel("")).toBe("chat");
		expect(normalizeChatSessionSubchannel("other")).toBe("chat");
		expect(normalizeChatSessionSubchannel(["task-info"])).toBe("task-info");
	});

	it("accepts only supported subchannels", () => {
		expect(normalizeChatSessionSubchannel("chat")).toBe("chat");
		expect(normalizeChatSessionSubchannel("task-info")).toBe("task-info");
		expect(normalizeChatSessionSubchannel("Task Info")).toBe("chat");
	});

	it("builds durable encoded session subchannel URLs", () => {
		expect(buildChatSessionHref("session-1")).toBe("/session/session-1/chat");
		expect(buildChatSessionHref("session/one", "task-info")).toBe(
			"/session/session%2Fone/task-info",
		);
	});

	it("reads the first app router param segment", () => {
		expect(readRouteParam("session-1")).toBe("session-1");
		expect(readRouteParam(["session-1", "ignored"])).toBe("session-1");
		expect(readRouteParam(undefined)).toBe("");
	});
});
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```bash
bun test packages/web/tests/chat-session-subchannels.test.ts
```

Expected: FAIL because `chat-session-subchannels` does not exist.

- [ ] **Step 3: Add the helper implementation**

Create `packages/web/src/components/chat-room/chat-session-subchannels.ts`:

```typescript
export const CHAT_SESSION_SUBCHANNELS = ["chat", "task-info"] as const;

export type ChatSessionSubchannel = (typeof CHAT_SESSION_SUBCHANNELS)[number];

export const DEFAULT_CHAT_SESSION_SUBCHANNEL: ChatSessionSubchannel = "chat";

export const CHAT_SESSION_SUBCHANNEL_LABELS: Record<
	ChatSessionSubchannel,
	string
> = {
	chat: "Chat",
	"task-info": "Task Info",
};

const supportedSubchannels = new Set<string>(CHAT_SESSION_SUBCHANNELS);

export function normalizeChatSessionSubchannel(
	value: string | string[] | undefined,
): ChatSessionSubchannel {
	const routeValue = readRouteParam(value);
	return supportedSubchannels.has(routeValue)
		? (routeValue as ChatSessionSubchannel)
		: DEFAULT_CHAT_SESSION_SUBCHANNEL;
}

export function buildChatSessionHref(
	sessionId: string,
	subchannel: ChatSessionSubchannel = DEFAULT_CHAT_SESSION_SUBCHANNEL,
): string {
	return `/session/${encodeURIComponent(sessionId)}/${subchannel}`;
}

export function readRouteParam(value: string | string[] | undefined): string {
	if (Array.isArray(value)) return value[0] ?? "";
	return value ?? "";
}
```

- [ ] **Step 4: Run the test to verify GREEN**

Run:

```bash
bun test packages/web/tests/chat-session-subchannels.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/web/src/components/chat-room/chat-session-subchannels.ts packages/web/tests/chat-session-subchannels.test.ts
git commit -m "feat: add chat session subchannel helpers"
```

## Task 2: Route And Shell Subchannel State

**Files:**
- Modify: `packages/web/src/components/web-shell/operator-chat-sidebar-route.ts`
- Modify: `packages/web/tests/operator-chat-sidebar-route.test.ts`
- Modify: `packages/web/src/components/web-shell/web-operator-shell.tsx`
- Modify: `packages/web/src/components/web-shell/operator-chat-sidebar.tsx`
- Modify: `packages/web/src/components/web-shell/types/operator-chat-sidebar.types.ts`
- Modify: `packages/web/src/components/web-shell/operator-chat-sidebar-render-utils.ts`
- Modify: `packages/web/src/app/(operator)/session/[sessionId]/page.tsx`
- Create: `packages/web/src/app/(operator)/session/[sessionId]/[subchannel]/page.tsx`

- [ ] **Step 1: Write failing route tests**

Append these tests to `packages/web/tests/operator-chat-sidebar-route.test.ts`:

```typescript
import {
	activeChatSessionRouteFromPathname,
	activeChatSessionSubchannelFromPathname,
} from "../src/components/web-shell/operator-chat-sidebar-route";

it("reads session subchannels from session routes", () => {
	expect(activeChatSessionSubchannelFromPathname("/chat")).toBe("chat");
	expect(activeChatSessionSubchannelFromPathname("/session/session-1")).toBe(
		"chat",
	);
	expect(
		activeChatSessionSubchannelFromPathname("/session/session-1/task-info"),
	).toBe("task-info");
	expect(
		activeChatSessionSubchannelFromPathname("/session/session-1/unknown"),
	).toBe("chat");
});

it("reads session id and subchannel together", () => {
	expect(
		activeChatSessionRouteFromPathname("/session/session%2Fone/task-info"),
	).toEqual({
		sessionId: "session/one",
		subchannel: "task-info",
	});
	expect(activeChatSessionRouteFromPathname("/issues")).toEqual({
		sessionId: "",
		subchannel: "chat",
	});
});
```

- [ ] **Step 2: Run route tests to verify RED**

Run:

```bash
bun test packages/web/tests/operator-chat-sidebar-route.test.ts
```

Expected: FAIL because the new route helpers are missing.

- [ ] **Step 3: Implement route parsing**

Update `packages/web/src/components/web-shell/operator-chat-sidebar-route.ts`:

```typescript
import {
	type ChatSessionSubchannel,
	DEFAULT_CHAT_SESSION_SUBCHANNEL,
	normalizeChatSessionSubchannel,
} from "@/components/chat-room/chat-session-subchannels";

const sessionRoutePrefix = "/session/";

export interface ActiveChatSessionRoute {
	sessionId: string;
	subchannel: ChatSessionSubchannel;
}

export function isChatSurfacePathname(pathname: string): boolean {
	return (
		pathname === "/chat" ||
		pathname.startsWith("/chat/") ||
		pathname.startsWith(sessionRoutePrefix)
	);
}

export function activeChatSessionIdFromPathname(pathname: string): string {
	return activeChatSessionRouteFromPathname(pathname).sessionId;
}

export function activeChatSessionSubchannelFromPathname(
	pathname: string,
): ChatSessionSubchannel {
	return activeChatSessionRouteFromPathname(pathname).subchannel;
}

export function activeChatSessionRouteFromPathname(
	pathname: string,
): ActiveChatSessionRoute {
	if (!pathname.startsWith(sessionRoutePrefix)) {
		return {
			sessionId: "",
			subchannel: DEFAULT_CHAT_SESSION_SUBCHANNEL,
		};
	}
	const [encodedSessionId = "", rawSubchannel] = pathname
		.slice(sessionRoutePrefix.length)
		.split("/");
	if (!encodedSessionId) {
		return {
			sessionId: "",
			subchannel: DEFAULT_CHAT_SESSION_SUBCHANNEL,
		};
	}
	return {
		sessionId: decodeSessionId(encodedSessionId),
		subchannel: normalizeChatSessionSubchannel(rawSubchannel),
	};
}

function decodeSessionId(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}
```

- [ ] **Step 4: Run route tests to verify GREEN**

Run:

```bash
bun test packages/web/tests/operator-chat-sidebar-route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Pass active subchannel through the operator shell**

In `packages/web/src/components/web-shell/web-operator-shell.tsx`, change the route import and derived route values:

```typescript
import {
	activeChatSessionRouteFromPathname,
	isChatSurfacePathname,
} from "./operator-chat-sidebar-route";
```

Replace the existing `activeSessionId` derivation with:

```typescript
const activeSessionRoute = activeChatSessionRouteFromPathname(pathname);
const activeSessionId = activeSessionRoute.sessionId;
const activeSubchannel = activeSessionRoute.subchannel;
```

Pass the subchannel into the sidebar:

```tsx
<OperatorChatSidebar
	activeSessionId={activeSessionId}
	activeSubchannel={activeSubchannel}
	isMobileOpen={isChatSidebarMobileOpen}
	onCloseMobileSidebar={closeChatSidebar}
	onSearch={openSearch}
/>
```

- [ ] **Step 6: Add the sidebar prop type and memo comparison**

Update `packages/web/src/components/web-shell/types/operator-chat-sidebar.types.ts`:

```typescript
import type { ChatSessionSubchannel } from "@/components/chat-room/chat-session-subchannels";

export interface OperatorChatSidebarProps {
	activeSessionId: string;
	activeSubchannel: ChatSessionSubchannel;
	isMobileOpen: boolean;
	onCloseMobileSidebar: () => void;
	onSearch: () => void;
}
```

Update `packages/web/src/components/web-shell/operator-chat-sidebar-render-utils.ts`:

```typescript
return (
	previous.activeSessionId === next.activeSessionId &&
	previous.activeSubchannel === next.activeSubchannel &&
	previous.isMobileOpen === next.isMobileOpen &&
	previous.onCloseMobileSidebar === next.onCloseMobileSidebar &&
	previous.onSearch === next.onSearch
);
```

- [ ] **Step 7: Route operator sidebar navigation to subchannel URLs**

In `packages/web/src/components/web-shell/operator-chat-sidebar.tsx`, import helpers:

```typescript
import {
	type ChatSessionSubchannel,
	buildChatSessionHref,
} from "@/components/chat-room/chat-session-subchannels";
```

Accept the new prop:

```typescript
function OperatorChatSidebarView({
	activeSessionId,
	activeSubchannel,
	isMobileOpen,
	onCloseMobileSidebar,
	onSearch,
}: OperatorChatSidebarProps): ReactElement {
```

Update `startNewSession`:

```typescript
router.push(buildChatSessionHref(session.id, "chat"));
```

Replace `selectSession` with:

```typescript
function selectSession(sessionId: string): void {
	selectSessionSubchannel(sessionId, "chat");
}

function selectSessionSubchannel(
	sessionId: string,
	subchannel: ChatSessionSubchannel,
): void {
	router.push(buildChatSessionHref(sessionId, subchannel));
	closeMobileSidebar();
}
```

Pass the subchannel props to `ChatRoomSidebar`:

```tsx
<ChatRoomSidebar
	activeSessionId={activeSessionId}
	activeSubchannel={activeSubchannel}
	error={sessionsQuery.error}
	isCollapsed={isSessionSidebarCollapsed}
	isCreating={createSession.isPending}
	isLoading={sessionsQuery.isLoading}
	isMobileOpen={isMobileOpen}
	projects={projectsQuery.data ?? []}
	runningSessionIds={runningSessionIds}
	sessions={sessionsQuery.data ?? []}
	onArchiveSession={(sessionId) => void archiveSession(sessionId)}
	onCloseSidebar={closeMobileSidebar}
	onNewSession={() => void startNewSession()}
	onSearch={search}
	onSelectSession={selectSession}
	onSelectSessionSubchannel={selectSessionSubchannel}
	onToggleCollapsed={toggleSessionSidebar}
/>
```

- [ ] **Step 8: Add durable subchannel pages**

Update `packages/web/src/app/(operator)/session/[sessionId]/page.tsx`:

```tsx
"use client";

import { useParams } from "next/navigation";
import type { ReactElement } from "react";

import {
	DEFAULT_CHAT_SESSION_SUBCHANNEL,
	readRouteParam,
} from "@/components/chat-room/chat-session-subchannels";
import { ChatRoomPanel } from "@/components/chat-room/chat-room-panel";
import { useOperatorIssueActions } from "@/components/web-shell/operator-issue-actions-context";

export default function SessionPage(): ReactElement {
	const { commandDraftRequest, requestOpenChatSidebar } =
		useOperatorIssueActions();
	const params = useParams<{ sessionId?: string | string[] }>();
	const sessionId = readRouteParam(params.sessionId);

	return (
		<ChatRoomPanel
			commandDraftRequest={commandDraftRequest}
			initialSessionId={sessionId}
			initialSubchannel={DEFAULT_CHAT_SESSION_SUBCHANNEL}
			key={`${sessionId}:${DEFAULT_CHAT_SESSION_SUBCHANNEL}`}
			onOpenSidebar={requestOpenChatSidebar}
		/>
	);
}
```

Create `packages/web/src/app/(operator)/session/[sessionId]/[subchannel]/page.tsx`:

```tsx
"use client";

import { useParams } from "next/navigation";
import type { ReactElement } from "react";

import {
	normalizeChatSessionSubchannel,
	readRouteParam,
} from "@/components/chat-room/chat-session-subchannels";
import { ChatRoomPanel } from "@/components/chat-room/chat-room-panel";
import { useOperatorIssueActions } from "@/components/web-shell/operator-issue-actions-context";

export default function SessionSubchannelPage(): ReactElement {
	const { commandDraftRequest, requestOpenChatSidebar } =
		useOperatorIssueActions();
	const params = useParams<{
		sessionId?: string | string[];
		subchannel?: string | string[];
	}>();
	const sessionId = readRouteParam(params.sessionId);
	const subchannel = normalizeChatSessionSubchannel(params.subchannel);

	return (
		<ChatRoomPanel
			commandDraftRequest={commandDraftRequest}
			initialSessionId={sessionId}
			initialSubchannel={subchannel}
			key={`${sessionId}:${subchannel}`}
			onOpenSidebar={requestOpenChatSidebar}
		/>
	);
}
```

- [ ] **Step 9: Typecheck the shell route changes**

Run:

```bash
bun run --filter web typecheck
```

Expected: PASS after the sidebar props are added in Task 3. If this fails only because `ChatRoomSidebarProps` does not yet accept `activeSubchannel` and `onSelectSessionSubchannel`, continue to Task 3 before re-running.

- [ ] **Step 10: Commit Task 2**

After Task 3 typecheck is green, commit Task 2 and Task 3 together if needed because their prop changes are coupled:

```bash
git add packages/web/src/components/web-shell/operator-chat-sidebar-route.ts packages/web/tests/operator-chat-sidebar-route.test.ts packages/web/src/components/web-shell/web-operator-shell.tsx packages/web/src/components/web-shell/operator-chat-sidebar.tsx packages/web/src/components/web-shell/types/operator-chat-sidebar.types.ts packages/web/src/components/web-shell/operator-chat-sidebar-render-utils.ts 'packages/web/src/app/(operator)/session/[sessionId]/page.tsx' 'packages/web/src/app/(operator)/session/[sessionId]/[subchannel]/page.tsx'
git commit -m "feat: route chat session subchannels"
```

## Task 3: Sidebar Subchannel Rows

**Files:**
- Modify: `packages/web/src/components/chat-room/types/chat-room-sidebar.types.ts`
- Modify: `packages/web/src/components/chat-room/chat-room-sidebar-utils.ts`
- Modify: `packages/web/tests/chat-room-sidebar-utils.test.ts`
- Modify: `packages/web/src/components/chat-room/chat-room-sidebar.tsx`
- Modify: `packages/web/src/components/chat-room/chat-room-session-list.tsx`
- Modify: `packages/web/src/components/chat-room/chat-room-session-row.tsx`

- [ ] **Step 1: Write failing sidebar helper tests**

Add imports in `packages/web/tests/chat-room-sidebar-utils.test.ts`:

```typescript
import {
	buildChatSessionSubchannelRows,
	shouldShowSessionSubchannels,
} from "../src/components/chat-room/chat-room-sidebar-utils";
```

Add tests:

```typescript
it("shows subchannel rows only for the active session", () => {
	expect(
		shouldShowSessionSubchannels({
			activeSessionId: "session-1",
			sessionId: "session-1",
		}),
	).toBe(true);
	expect(
		shouldShowSessionSubchannels({
			activeSessionId: "session-1",
			sessionId: "session-2",
		}),
	).toBe(false);
});

it("builds chat and task-info child rows for the active session", () => {
	const rows = buildChatSessionSubchannelRows({
		activeSessionId: "session-1",
		activeSubchannel: "task-info",
		sessionId: "session-1",
	});

	expect(rows).toEqual([
		{
			href: "/session/session-1/chat",
			id: "chat",
			isActive: false,
			label: "Chat",
		},
		{
			href: "/session/session-1/task-info",
			id: "task-info",
			isActive: true,
			label: "Task Info",
		},
	]);
});

it("returns no child rows for inactive sessions", () => {
	expect(
		buildChatSessionSubchannelRows({
			activeSessionId: "session-1",
			activeSubchannel: "chat",
			sessionId: "session-2",
		}),
	).toEqual([]);
});
```

- [ ] **Step 2: Run sidebar tests to verify RED**

Run:

```bash
bun test packages/web/tests/chat-room-sidebar-utils.test.ts
```

Expected: FAIL because subchannel row helpers are missing.

- [ ] **Step 3: Add sidebar subchannel types**

In `packages/web/src/components/chat-room/types/chat-room-sidebar.types.ts`, import the subchannel type:

```typescript
import type { ChatSessionSubchannel } from "../chat-session-subchannels";
```

Add props to `ChatRoomSidebarProps`, `ChatRoomSessionListProps`, and `ChatRoomSessionRowProps`:

```typescript
activeSubchannel: ChatSessionSubchannel;
onSelectSessionSubchannel: (
	sessionId: string,
	subchannel: ChatSessionSubchannel,
) => void;
```

Add helper types:

```typescript
export interface ChatSessionSubchannelRow {
	href: string;
	id: ChatSessionSubchannel;
	isActive: boolean;
	label: string;
}

export interface BuildChatSessionSubchannelRowsInput {
	activeSessionId: string;
	activeSubchannel: ChatSessionSubchannel;
	sessionId: string;
}

export interface ShouldShowSessionSubchannelsInput {
	activeSessionId: string;
	sessionId: string;
}
```

- [ ] **Step 4: Add pure row helpers**

In `packages/web/src/components/chat-room/chat-room-sidebar-utils.ts`, add imports:

```typescript
import {
	CHAT_SESSION_SUBCHANNELS,
	CHAT_SESSION_SUBCHANNEL_LABELS,
	buildChatSessionHref,
} from "./chat-session-subchannels";
```

Add type imports:

```typescript
BuildChatSessionSubchannelRowsInput,
ChatSessionSubchannelRow,
ShouldShowSessionSubchannelsInput,
```

Add helper functions:

```typescript
export function shouldShowSessionSubchannels({
	activeSessionId,
	sessionId,
}: ShouldShowSessionSubchannelsInput): boolean {
	return Boolean(sessionId) && sessionId === activeSessionId;
}

export function buildChatSessionSubchannelRows({
	activeSessionId,
	activeSubchannel,
	sessionId,
}: BuildChatSessionSubchannelRowsInput): ChatSessionSubchannelRow[] {
	if (!shouldShowSessionSubchannels({ activeSessionId, sessionId })) {
		return [];
	}
	return CHAT_SESSION_SUBCHANNELS.map((subchannel) => ({
		href: buildChatSessionHref(sessionId, subchannel),
		id: subchannel,
		isActive: subchannel === activeSubchannel,
		label: CHAT_SESSION_SUBCHANNEL_LABELS[subchannel],
	}));
}
```

- [ ] **Step 5: Run sidebar helper tests to verify GREEN**

Run:

```bash
bun test packages/web/tests/chat-room-sidebar-utils.test.ts
```

Expected: PASS.

- [ ] **Step 6: Thread subchannel props through sidebar components**

In `packages/web/src/components/chat-room/chat-room-sidebar.tsx`, destructure and pass `activeSubchannel` and `onSelectSessionSubchannel` into `ChatRoomSessionList`.

In `packages/web/src/components/chat-room/chat-room-session-list.tsx`, destructure the same props and pass them into every `ChatRoomSessionRow` for pinned and project sessions:

```tsx
<ChatRoomSessionRow
	activeSessionId={activeSessionId}
	activeSubchannel={activeSubchannel}
	isPinned={false}
	isRunning={runningSessionIds.has(session.id)}
	key={session.id}
	onArchiveSession={onArchiveSession}
	onPinSession={onPinSession}
	onSelectSession={onSelectSession}
	onSelectSessionSubchannel={onSelectSessionSubchannel}
	onUnpinSession={onUnpinSession}
	session={session}
/>
```

Keep the pinned variant identical except `isPinned={true}`.

- [ ] **Step 7: Render child subchannel rows in session rows**

Update imports in `packages/web/src/components/chat-room/chat-room-session-row.tsx`:

```typescript
import { Hash, Archive, Loader2, Pin, PinOff } from "lucide-react";
import { buildChatSessionHref } from "./chat-session-subchannels";
import { buildChatSessionSubchannelRows } from "./chat-room-sidebar-utils";
```

Destructure new props:

```typescript
activeSubchannel,
onSelectSessionSubchannel,
```

Build rows:

```typescript
const subchannelRows = buildChatSessionSubchannelRows({
	activeSessionId,
	activeSubchannel,
	sessionId: session.id,
});
```

Replace the top-level return with this shape:

```tsx
return (
	<div className="grid min-w-0 gap-1">
		<div
			className={cn(
				"group grid min-w-0 grid-cols-[minmax(0,1fr)_2rem_2rem] gap-0 rounded-md border border-transparent hover:bg-surface-active hover:text-zinc-200",
				isRunning && "border-emerald-400/30 bg-emerald-500/5",
				session.id === activeSessionId
					? "bg-[#111110] text-zinc-100"
					: "text-zinc-400",
			)}
		>
			<Link
				className={cn(
					buttonVariants({ variant: "ghost" }),
					"h-auto min-w-0 justify-start gap-2 py-2 pl-2 pr-0 text-left text-sm",
				)}
				href={sessionHref}
				onClick={handleSessionClick}
			>
				{isRunning ? (
					<span
						className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-emerald-300"
						title="AI model running"
					>
						<Loader2 aria-hidden="true" className="animate-spin" size={14} />
						<span className="sr-only">AI model running</span>
					</span>
				) : null}
				<span className="min-w-0 flex-1">
					<Typography as="span" className="block truncate">
						{session.title}
					</Typography>
				</span>
			</Link>
			<Button
				aria-label={pinLabel}
				aria-pressed={isPinned}
				className={cn(
					"transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
					isPinned ? "opacity-100" : "opacity-0",
				)}
				onClick={handlePinClick}
				size="icon"
				title={isPinned ? "Unpin session" : "Pin session"}
				type="button"
				variant="ghost"
			>
				{isPinned ? <PinOff size={14} /> : <Pin size={14} />}
			</Button>
			<Dialog>
				<DialogTrigger asChild>
					<Button
						aria-label={`Archive ${session.title}`}
						className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
						size="icon"
						title="Archive session"
						type="button"
						variant="ghost"
					>
						<Archive size={14} />
					</Button>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Archive session?</DialogTitle>
						<DialogDescription>
							Archive "{session.title}" and remove it from the sidebar.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose asChild>
							<Button type="button" variant="outline">
								Cancel
							</Button>
						</DialogClose>
						<DialogClose asChild>
							<Button
								onClick={() => onArchiveSession(session.id)}
								type="button"
								variant="destructive"
							>
								Archive
							</Button>
						</DialogClose>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
		{subchannelRows.length > 0 ? (
			<div className="grid gap-1 pl-6">
				{subchannelRows.map((row) => (
					<Link
						aria-current={row.isActive ? "page" : undefined}
						className={cn(
							buttonVariants({ variant: "ghost" }),
							"h-8 min-w-0 justify-start gap-2 px-2 text-left text-xs",
							row.isActive
								? "bg-surface-active text-zinc-100"
								: "text-zinc-400 hover:bg-surface-active hover:text-zinc-200",
						)}
						href={row.href}
						key={row.id}
						onClick={(event) => handleSubchannelClick(event, row.id)}
					>
						<Hash aria-hidden="true" className="shrink-0" size={13} />
						<Typography as="span" className="min-w-0 flex-1 truncate">
							{row.label}
						</Typography>
					</Link>
				))}
			</div>
		) : null}
	</div>
);
```

Add the click handler:

```typescript
function handleSubchannelClick(
	event: MouseEvent<HTMLAnchorElement>,
	subchannel: typeof activeSubchannel,
): void {
	if (
		event.defaultPrevented ||
		event.button !== 0 ||
		event.metaKey ||
		event.altKey ||
		event.ctrlKey ||
		event.shiftKey
	) {
		return;
	}
	event.preventDefault();
	onSelectSessionSubchannel(session.id, subchannel);
}
```

Update `sessionHref` to use the helper:

```typescript
const sessionHref = buildChatSessionHref(session.id, "chat");
```

- [ ] **Step 8: Run focused sidebar checks**

Run:

```bash
bun test packages/web/tests/chat-room-sidebar-utils.test.ts packages/web/tests/operator-chat-sidebar-route.test.ts packages/web/tests/chat-session-subchannels.test.ts
bun run --filter web typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit Task 3**

If Task 2 was not committed because typecheck needed these prop changes, commit both tasks together. Otherwise commit:

```bash
git add packages/web/src/components/chat-room/types/chat-room-sidebar.types.ts packages/web/src/components/chat-room/chat-room-sidebar-utils.ts packages/web/tests/chat-room-sidebar-utils.test.ts packages/web/src/components/chat-room/chat-room-sidebar.tsx packages/web/src/components/chat-room/chat-room-session-list.tsx packages/web/src/components/chat-room/chat-room-session-row.tsx
git commit -m "feat: show session subchannels in sidebar"
```

## Task 4: Main-Panel Task Info Channel

**Files:**
- Modify: `packages/web/src/components/chat-room/types/chat-room.types.ts`
- Modify: `packages/web/src/components/chat-room/chat-room-panel.tsx`
- Modify: `packages/web/src/components/chat-room/chat-room-panel-view.tsx`
- Modify: `packages/web/src/components/chat-room/chat-room-header.tsx`
- Create: `packages/web/src/components/chat-room/chat-task-info-channel.tsx`
- Delete: `packages/web/src/components/chat-room/use-chat-task-detail-panel-state.ts`
- Delete: `packages/web/src/components/chat-room/chat-task-detail-sheet.tsx`

- [ ] **Step 1: Update chat room types**

In `packages/web/src/components/chat-room/types/chat-room.types.ts`, import the subchannel type:

```typescript
import type { ChatSessionSubchannel } from "../chat-session-subchannels";
```

Update `ChatRoomPanelProps`:

```typescript
export interface ChatRoomPanelProps {
	commandDraftRequest: CommandDraftRequest | null;
	initialSessionId?: string;
	initialSubchannel?: ChatSessionSubchannel;
	onOpenSidebar: () => void;
}
```

Update `ChatRoomHeaderProps`:

```typescript
export interface ChatRoomHeaderProps {
	isRerunDisabled: boolean;
	isRerunning: boolean;
	isRerunVisible: boolean;
	projectId: string;
	subchannelLabel: string;
	title: string;
	onOpenSidebar: () => void;
	onRerunWorkflow: () => void;
}
```

Update `ChatRoomPanelViewProps` by adding:

```typescript
activeSubchannel: ChatSessionSubchannel;
```

Remove these fields from `ChatRoomPanelViewProps`:

```typescript
isTaskDetailPanelOpen: boolean;
onCloseTaskDetails: () => void;
onToggleTaskDetails: () => void;
```

Remove `ChatTaskDetailPanelProps`.

- [ ] **Step 2: Add the Task Info channel component**

Create `packages/web/src/components/chat-room/chat-task-info-channel.tsx`:

```tsx
"use client";

import {
	Bot,
	CalendarDays,
	Circle,
	Clock3,
	GitPullRequest,
	Hash,
	UserRound,
} from "lucide-react";
import type { ReactElement } from "react";

import { Typography } from "@/components/ui/typography";
import type { ProjectBoardTaskRecord, TokenUsageRecord } from "@/lib/api";
import { useBoardTaskQuery, useTokenUsageQuery } from "@/lib/api/queries";

import { IssueActivityPanel } from "../issues-board/issue-activity";
import { ExternalLinkValue, formatDateTime } from "../issues-board/issue-detail-editor-utils";
import {
	MetricRow,
	PanelSection,
	PanelState,
	PropertyRow,
} from "../issues-board/issue-task-detail-panel-parts";
import {
	formatDueDate,
	summarizeTokenUsage,
} from "../issues-board/issue-task-detail-panel-utils";
import {
	getPriorityLabel,
	getStatusLabel,
	isAgentTask,
} from "../issues-board/issues-board-utils";
import { MissionBody } from "./chat-mission-progress-sections";
import type { ChatMissionProgressViewModel } from "./types/chat-mission-progress.types";

export function ChatTaskInfoChannel({
	missionProgress,
	taskId,
}: {
	missionProgress: ChatMissionProgressViewModel | null;
	taskId: string | null;
}): ReactElement {
	const isEnabled = Boolean(taskId);
	const taskQuery = useBoardTaskQuery(taskId ?? "", {
		enabled: isEnabled,
		refetchIntervalMs: false,
	});
	const usageQuery = useTokenUsageQuery({
		enabled: isEnabled,
		refetchIntervalMs: false,
	});
	const usageRecords = (usageQuery.data ?? []).filter(
		(record) => record.taskId === taskId,
	);

	if (!taskId) {
		return <TaskInfoState label="No linked task" />;
	}
	if (taskQuery.isLoading) {
		return <TaskInfoState label="Loading task" />;
	}
	if (taskQuery.error) {
		return <TaskInfoState label={taskQuery.error.message} />;
	}
	if (!taskQuery.data) {
		return <TaskInfoState label="Task not found" />;
	}

	return (
		<div className="min-h-0 overflow-y-auto px-4 py-5">
			<div className="mx-auto grid w-full max-w-4xl gap-5">
				<TaskInfoHeader task={taskQuery.data} />
				<TaskInfoProperties task={taskQuery.data} />
				{missionProgress ? <MissionBody mission={missionProgress} /> : null}
				<TaskInfoUsage
					isLoading={usageQuery.isLoading}
					records={usageRecords}
				/>
				<IssueActivityPanel task={taskQuery.data} />
			</div>
		</div>
	);
}

function TaskInfoHeader({
	task,
}: {
	task: ProjectBoardTaskRecord;
}): ReactElement {
	return (
		<section className="grid gap-3 rounded-md border border-border bg-card p-5">
			<Typography variant="eyebrow">{task.taskKey}</Typography>
			<Typography className="break-words text-xl leading-7" variant="pageTitle">
				{task.title}
			</Typography>
			<Typography className="whitespace-pre-wrap break-words leading-6 text-zinc-400">
				{task.content.trim() || "No description"}
			</Typography>
		</section>
	);
}

function TaskInfoProperties({
	task,
}: {
	task: ProjectBoardTaskRecord;
}): ReactElement {
	const AssigneeIcon = isAgentTask(task) ? Bot : UserRound;
	return (
		<PanelSection title="Properties">
			<PropertyRow icon={<Circle size={17} />} label="Status">
				{getStatusLabel(task.status)}
			</PropertyRow>
			<PropertyRow icon={<AssigneeIcon size={17} />} label="Assignee">
				{task.assigneeId ?? task.creatorId}
			</PropertyRow>
			<PropertyRow icon={<Hash size={17} />} label="Priority">
				{getPriorityLabel(task.priority)}
			</PropertyRow>
			<PropertyRow icon={<CalendarDays size={17} />} label="Due date">
				{formatDueDate(task.dueDate)}
			</PropertyRow>
			<PropertyRow icon={<GitPullRequest size={17} />} label="Pull request">
				{task.linkedPr ? (
					<ExternalLinkValue href={task.linkedPr} />
				) : (
					"No linked pull request"
				)}
			</PropertyRow>
			<PropertyRow icon={<UserRound size={17} />} label="Created by">
				{task.creatorId}
			</PropertyRow>
			<PropertyRow icon={<Clock3 size={17} />} label="Created">
				{formatDateTime(task.createdAt)}
			</PropertyRow>
			<PropertyRow icon={<Clock3 size={17} />} label="Updated">
				{formatDateTime(task.updatedAt)}
			</PropertyRow>
		</PanelSection>
	);
}

function TaskInfoUsage({
	isLoading,
	records,
}: {
	isLoading: boolean;
	records: TokenUsageRecord[];
}): ReactElement {
	const summary = summarizeTokenUsage(records);
	return (
		<PanelSection title="Token usage">
			{isLoading ? (
				<Typography variant="description">Loading usage</Typography>
			) : records.length === 0 ? (
				<Typography variant="description">No token usage yet</Typography>
			) : (
				<>
					<MetricRow label="Input" value={summary.inputTokens} />
					<MetricRow label="Output" value={summary.outputTokens} />
					<MetricRow label="Total" value={summary.totalTokens} />
					<MetricRow label="Runs" value={summary.runs} />
				</>
			)}
		</PanelSection>
	);
}

function TaskInfoState({ label }: { label: string }): ReactElement {
	return (
		<div className="grid min-h-0 flex-1 place-items-center px-6 py-10 text-sm text-muted-foreground">
			<PanelState label={label} />
		</div>
	);
}
```

- [ ] **Step 3: Remove sheet state from `ChatRoomPanel`**

In `packages/web/src/components/chat-room/chat-room-panel.tsx`:

Remove this import:

```typescript
import { useChatTaskDetailPanelState } from "./use-chat-task-detail-panel-state";
```

Import defaults:

```typescript
import {
	type ChatSessionSubchannel,
	buildChatSessionHref,
	DEFAULT_CHAT_SESSION_SUBCHANNEL,
} from "./chat-session-subchannels";
```

Accept the prop:

```typescript
export function ChatRoomPanel({
	commandDraftRequest,
	initialSessionId = "",
	initialSubchannel = DEFAULT_CHAT_SESSION_SUBCHANNEL,
	onOpenSidebar,
}: CRT.ChatRoomPanelProps): ReactElement {
```

Add state:

```typescript
const [activeSubchannel, setActiveSubchannel] =
	useState<ChatSessionSubchannel>(initialSubchannel);
```

Remove:

```typescript
const taskDetails = useChatTaskDetailPanelState({
	activeTaskId,
	selectedSessionId,
});
```

In `startNewSession`, replace `taskDetails.close();` with:

```typescript
setActiveSubchannel("chat");
```

When pushing new session URLs, use:

```typescript
router.push(buildChatSessionHref(session.id, "chat"));
```

Do the same for the `handleSubmit` new-session branch.

Pass `activeSubchannel` into `ChatRoomPanelView`, and remove task-detail props:

```tsx
<ChatRoomPanelView
	activeSubchannel={activeSubchannel}
	activeTaskId={activeTaskId}
	draft={draft}
	isBusy={isBusy}
	isMessagesLoading={messagesQuery.isLoading}
	isRerunDisabled={rerunState.isDisabled}
	isRerunning={isRerunning}
	isRerunVisible={rerunState.isVisible}
	isSending={sendMessage.isPending}
	isPlanning={isPlanning}
	isThinking={isThinking}
	missionProgress={missionProgress}
	messages={messages}
	messagesError={messagesQuery.error}
	pendingAnswers={pendingAnswers}
	pendingQuestionIndex={pendingQuestionIndex}
	selectedSession={selectedSession}
	streamLines={streamLines}
	workingStartedAt={workingStartedAt ?? activityStartedAt}
	onAnswerChange={(index, value) =>
		clarificationState.updateAnswerDraft(selectedSessionId, index, value)
	}
	onDraftChange={handleDraftChange}
	onOpenSidebar={onOpenSidebar}
	onRerunWorkflow={() => void handleRerunWorkflow()}
	onSelectCommand={setDraft}
	onSelectOption={(index, value) =>
		clarificationSubmitters.submitAnswerValue(index, value)
	}
	onSubmit={() => void handleSubmit()}
	onSubmitAnswers={() => void clarificationSubmitters.submitAnswers()}
/>
```

- [ ] **Step 4: Render `Chat` or `Task Info` in the panel view**

In `packages/web/src/components/chat-room/chat-room-panel-view.tsx`, remove the `ChatTaskDetailPanel` import and import:

```typescript
import {
	CHAT_SESSION_SUBCHANNEL_LABELS,
} from "./chat-session-subchannels";
import { ChatTaskInfoChannel } from "./chat-task-info-channel";
```

Destructure `activeSubchannel`. Add:

```typescript
const isTaskInfoChannel = activeSubchannel === "task-info";
const subchannelLabel = CHAT_SESSION_SUBCHANNEL_LABELS[activeSubchannel];
```

Remove `hasOpenTaskDetails` and the two-column `layoutClassName` branch:

```typescript
const layoutClassName =
	"relative grid h-[100dvh] min-w-0 grid-rows-[minmax(0,1fr)] overflow-hidden bg-background text-zinc-100";
```

Update `ChatRoomHeader` props:

```tsx
<ChatRoomHeader
	isRerunDisabled={isRerunDisabled}
	isRerunning={isRerunning}
	isRerunVisible={isRerunVisible}
	projectId={selectedSession.projectId ?? "default"}
	subchannelLabel={subchannelLabel}
	title={selectedSession.title}
	onOpenSidebar={onOpenSidebar}
	onRerunWorkflow={onRerunWorkflow}
/>
```

Replace transcript/composer rendering with:

```tsx
{isTaskInfoChannel ? (
	<ChatTaskInfoChannel
		missionProgress={missionProgress}
		taskId={activeTaskId}
	/>
) : (
	<>
		<ChatTranscript
			error={messagesError}
			isLoading={showLoadingShell}
			isPlanning={isPlanning}
			isThinking={isThinking}
			missionProgress={missionProgress}
			messages={messages}
			showMissionSkeleton={showMissionSkeleton}
			session={selectedSession}
			streamLines={streamLines}
			workingStartedAt={workingStartedAt}
			onDraftCommand={onSelectCommand}
		/>
		{showLoadingShell ? (
			<ChatComposerSkeleton />
		) : hasPendingQuestions ? (
			<ChatClarificationComposer
				answers={pendingAnswers}
				disabled={isBusy || isSending}
				pendingQuestionIndex={pendingQuestionIndex}
				questions={pendingQuestions}
				onAnswerChange={onAnswerChange}
				onSelectOption={onSelectOption}
				onSubmit={onSubmitAnswers}
			/>
		) : (
			<ChatComposer
				disabled={isBusy}
				draft={draft}
				isSending={isSending}
				onDraftChange={onDraftChange}
				onSelectCommand={onSelectCommand}
				onSubmit={onSubmit}
			/>
		)}
	</>
)}
```

Remove the final `<ChatTaskDetailPanel />`.

- [ ] **Step 5: Remove the old Details button**

In `packages/web/src/components/chat-room/chat-room-header.tsx`, remove `FileText` import and task-detail props. Render the header subtitle:

```tsx
<div className="min-w-0">
	<Typography className="truncate text-zinc-300">{title}</Typography>
	<Typography className="mt-1 truncate" variant="muted">
		{projectId} / {subchannelLabel}
	</Typography>
</div>
```

Keep the rerun button unchanged. Remove the `Details` button block.

- [ ] **Step 6: Delete unused sheet files**

Run:

```bash
rg -n "ChatTaskDetailPanel|useChatTaskDetailPanelState|chat-task-detail-sheet" packages/web/src packages/web/tests
```

Expected before deletion: only the old imports/usages identified in this task.

Delete `packages/web/src/components/chat-room/use-chat-task-detail-panel-state.ts`.

Delete `packages/web/src/components/chat-room/chat-task-detail-sheet.tsx`.

- [ ] **Step 7: Run focused compile checks**

Run:

```bash
bun run --filter web typecheck
```

Expected: PASS. If file-size checks are separate in this repo, also run:

```bash
wc -l packages/web/src/components/chat-room/chat-room-panel-view.tsx packages/web/src/components/chat-room/chat-task-info-channel.tsx packages/web/src/components/chat-room/chat-room-session-row.tsx packages/web/src/components/chat-room/chat-room-session-list.tsx
```

Expected: each TypeScript file stays under 250 lines.

- [ ] **Step 8: Commit Task 4**

```bash
git add packages/web/src/components/chat-room/types/chat-room.types.ts packages/web/src/components/chat-room/chat-room-panel.tsx packages/web/src/components/chat-room/chat-room-panel-view.tsx packages/web/src/components/chat-room/chat-room-header.tsx packages/web/src/components/chat-room/chat-task-info-channel.tsx packages/web/src/components/chat-room/use-chat-task-detail-panel-state.ts packages/web/src/components/chat-room/chat-task-detail-sheet.tsx
git commit -m "feat: render task info as a chat subchannel"
```

## Task 5: Verification And Browser QA

**Files:**
- No new source files unless verification finds a bug.

- [ ] **Step 1: Run focused tests**

Run:

```bash
bun test packages/web/tests/chat-session-subchannels.test.ts packages/web/tests/operator-chat-sidebar-route.test.ts packages/web/tests/chat-room-sidebar-utils.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run web checks**

Run:

```bash
bun run --filter web typecheck
bun run --filter web build
```

Expected: both PASS. If `web build` fails in sandbox with a Turbopack port-binding error, rerun the same command outside the sandbox before treating it as a code failure.

- [ ] **Step 3: Run root quality gates**

Run from repo root:

```bash
bun run check
bun run typecheck
bun test
```

Expected: all PASS. If unrelated pre-existing dirty files cause failures, record the exact failing command and prove the touched web checks still pass.

- [ ] **Step 4: Browser verification**

Start the web app:

```bash
bun run --filter web dev
```

Open a session route in the browser:

```text
http://localhost:3000/session/<existing-session-id>/chat
```

Verify:

- left sidebar shows `Sessions -> Project -> Session -> Chat / Task Info`
- `Chat` child row is active on `/chat`
- clicking `Task Info` navigates to `/session/<id>/task-info`
- `Task Info` child row becomes active
- main panel renders task title/status/PR/mission or a quiet `No linked task` state
- switching back to `Chat` preserves chat messages and composer state through React Query/cache-backed data
- mobile viewport shows the same child rows after opening the sidebar
- there is no old `Details` side sheet button in the header

- [ ] **Step 5: Final status check**

Run:

```bash
git status --short --branch
```

Expected: only intentional files changed or clean after commits. Do not stage unrelated files from the original dirty checkout.

- [ ] **Step 6: Commit any verification fixes**

If browser QA or checks required small fixes, commit only those files:

```bash
git add <intentional-files>
git commit -m "fix: polish session subchannel navigation"
```

## Handoff Notes

- The implementation should preserve `/session/:sessionId` as a valid old route that renders `Chat`.
- The durable default for all new navigation is `/session/:sessionId/chat`.
- `Task Info` must use existing React Query hooks: `useBoardTaskQuery`, `useTaskActivityQuery` through `IssueActivityPanel`, and `useTokenUsageQuery`.
- Do not add direct `fetch` calls in UI components.
- Keep the old issue-board task surfaces intact; only the chatroom task-detail side sheet is replaced by the subchannel.
