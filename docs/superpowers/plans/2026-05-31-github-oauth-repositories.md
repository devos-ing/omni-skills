# GitHub OAuth Repository Listing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support connecting a GitHub account through local OAuth so the Projects create/edit repository picker can list repositories without requiring `gh auth login`.

**Architecture:** The server owns OAuth configuration checks, state-cookie validation, token exchange, local token persistence, disconnect, and GitHub REST repository fetching. The web API client exposes connection state and repository listing, while the Projects dialog renders configured, disconnected, connected, and unavailable states and preserves manual owner/repo entry.

**Tech Stack:** Bun, TypeScript, server `fetch`, GitHub OAuth, GitHub REST API, local `env.sqlite`, Next.js React client components, React Query.

---

### File Structure

Server:
- Modify `packages/server/src/http/github-repositories-routes.ts` to route `/api/github/connection`, `/api/github/oauth/start`, `/api/github/oauth/callback`, `/api/github/connection` DELETE, and `/api/github/repositories`.
- Modify `packages/server/src/http/types/github-repositories-api.types.ts` to replace the GitHub CLI runner contract with OAuth route dependencies and add connection response types.
- Modify `packages/server/tests/github-repositories-routes.test.ts` to cover OAuth connection, callback, disconnect, and REST-backed repository listing.

Web:
- Modify `packages/web/src/lib/api/types/client.types.ts` to add `GitHubConnectionResponse`.
- Modify `packages/web/src/lib/api/github-client.ts` to parse connection responses and expose connection/disconnect methods.
- Modify `packages/web/src/lib/api/query-keys.ts` to add a `gitHubConnection` key.
- Modify `packages/web/src/lib/api/realtime-queries.ts` to add `useGitHubConnectionQuery`.
- Modify `packages/web/tests/github-repositories-client.test.ts` for new client methods and parser checks.
- Modify `packages/web/src/components/projects/projects-panel-utils.ts` to add a pure helper for repository selector state.
- Modify `packages/web/tests/projects-panel-utils.test.ts` for the helper.
- Modify `packages/web/src/components/projects/project-create-dialog-fields.tsx` to show GitHub connect/retry/manual states in the repository fieldset.
- Modify `packages/web/src/components/projects/project-create-dialog.tsx` to pass GitHub connection props through.
- Modify `packages/web/src/components/projects/projects-panel.tsx` to query connection state, enable repository listing only when connected, and navigate to OAuth start.

### Pre-Flight

- [ ] Run `rtk git status --short --branch` and confirm only expected files are dirty.
- [ ] Run `rtk git fetch origin main`, `rtk git switch main`, `rtk git pull --ff-only origin main`, then return to the feature branch and rebase or merge as the repo workflow requires. Stop and report if main sync cannot complete.
- [ ] Read `packages/server/AGENTS.md` before server edits and `packages/web/AGENTS.md` before web edits.

### Task 1: Add Server OAuth Tests

**Files:**
- Modify `packages/server/tests/github-repositories-routes.test.ts`
- Modify `packages/server/src/http/types/github-repositories-api.types.ts`
- Modify `packages/server/src/http/github-repositories-routes.ts`

- [ ] **Step 1: Replace the CLI-oriented test setup with OAuth route dependency tests**

Add tests using an in-memory env store and mocked `fetch`. The tests should call `handleGitHubRepositoriesRoute(request, pathname, "/workspace", deps)` and expect the current implementation to fail before route dependency support exists.

Use this dependency shape in the tests:

```ts
type FetchCall = {
	input: URL | RequestInfo;
	init?: RequestInit;
};

function createRouteDeps(options?: {
	env?: Record<string, string>;
	initialStore?: Record<string, string>;
	fetchFn?: typeof fetch;
}) {
	const store = { ...(options?.initialStore ?? {}) };
	const saves: Array<Record<string, string | undefined>> = [];
	const fetchCalls: FetchCall[] = [];
	const fetchFn = (async (input, init) => {
		fetchCalls.push({ input, init });
		return options?.fetchFn?.(input, init) ?? new Response("{}", { status: 500 });
	}) as typeof fetch;

	return {
		deps: {
			env: options?.env ?? {
				GITHUB_OAUTH_CLIENT_ID: "client-id",
				GITHUB_OAUTH_CLIENT_SECRET: "client-secret",
			},
			fetchFn,
			loadEnv: async () => ({ ...store }),
			randomState: () => "state-123",
			saveEnv: async (_cwd: string, updates: Record<string, string | undefined>) => {
				saves.push(updates);
				for (const [key, value] of Object.entries(updates)) {
					if (value === undefined) {
						delete store[key];
					} else {
						store[key] = value;
					}
				}
			},
		},
		fetchCalls,
		saves,
		store,
	};
}
```

- [ ] **Step 2: Test `/api/github/connection` states**

Cover unconfigured, configured/disconnected, and connected states:

```ts
const unconfigured = await handleGitHubRepositoriesRoute(
	new Request("http://localhost/api/github/connection"),
	"/api/github/connection",
	"/workspace",
	createRouteDeps({ env: {} }).deps,
);

expect(await unconfigured?.json()).toEqual({
	isConfigured: false,
	isConnected: false,
	login: null,
	unavailableReason: "GitHub OAuth is not configured",
});
```

Also assert a configured token store returns:

```ts
{
	isConfigured: true,
	isConnected: true,
	login: "octo",
	unavailableReason: null,
}
```

- [ ] **Step 3: Test OAuth start redirect and state cookie**

Call `GET /api/github/oauth/start` and assert:
- status is `302`.
- `Location` starts with `https://github.com/login/oauth/authorize`.
- query includes `client_id=client-id`, `scope=repo`, `state=state-123`, and `redirect_uri=http://localhost/api/github/oauth/callback`.
- `Set-Cookie` contains `devos_github_oauth_state=state-123`, `HttpOnly`, `SameSite=Lax`, `Path=/api/github/oauth`, and `Max-Age=600`.

- [ ] **Step 4: Test callback exchange, user fetch, persistence, and redirect**

Use mocked fetch responses:

```ts
const fetchFn = (async (input: URL | RequestInfo) => {
	const url = String(input);
	if (url === "https://github.com/login/oauth/access_token") {
		return new Response(JSON.stringify({ access_token: "token-123" }), {
			headers: { "content-type": "application/json" },
			status: 200,
		});
	}
	if (url === "https://api.github.com/user") {
		return new Response(JSON.stringify({ login: "octo" }), {
			headers: { "content-type": "application/json" },
			status: 200,
		});
	}
	return new Response("{}", { status: 404 });
}) as typeof fetch;
```

Call:

```ts
new Request(
	"http://localhost/api/github/oauth/callback?code=code-123&state=state-123",
	{ headers: { cookie: "devos_github_oauth_state=state-123" } },
)
```

Assert:
- token exchange uses `POST`.
- user fetch uses `Authorization: Bearer token-123`.
- saved updates include `GITHUB_OAUTH_ACCESS_TOKEN: "token-123"` and `GITHUB_OAUTH_LOGIN: "octo"`.
- status is `302`.
- `Location` is `http://localhost/projects?github=connected`.
- callback response clears the state cookie with `Max-Age=0`.

- [ ] **Step 5: Test callback rejects invalid state without storing**

Call callback with mismatched query/cookie state and assert status `400`, JSON error, and no `saveEnv` calls.

- [ ] **Step 6: Test disconnect clears stored values**

Call `DELETE /api/github/connection` and assert the response is connected false and saved updates are:

```ts
{
	GITHUB_OAUTH_ACCESS_TOKEN: undefined,
	GITHUB_OAUTH_LOGIN: undefined,
}
```

- [ ] **Step 7: Test REST-backed repository listing**

Seed `GITHUB_OAUTH_ACCESS_TOKEN: "token-123"` and mock `GET https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member`.

The test response should include at least:

```ts
[
	{
		id: 42,
		name: "core",
		full_name: "octo/core",
		default_branch: "trunk",
		private: true,
		owner: { login: "octo" },
	},
]
```

Assert the route returns:

```ts
{
	isAvailable: true,
	unavailableReason: null,
	repositories: [
		{
			id: "42",
			owner: "octo",
			name: "core",
			nameWithOwner: "octo/core",
			defaultBranch: "trunk",
			isPrivate: true,
		},
	],
}
```

- [ ] **Step 8: Test repository listing unavailable states**

Assert repository listing returns `isAvailable: false` and an empty list when OAuth is unconfigured, disconnected, GitHub returns a non-2xx response, or GitHub returns malformed JSON. Do not expose raw token, code, or response body in the unavailable reason.

- [ ] **Step 9: Run focused server tests and confirm RED**

Run:

```bash
bun test packages/server/tests/github-repositories-routes.test.ts
```

Expected: tests fail because the server still uses `gh repo list` and has no OAuth route dependency contract.

### Task 2: Implement Server OAuth Routes

**Files:**
- Modify `packages/server/src/http/types/github-repositories-api.types.ts`
- Modify `packages/server/src/http/github-repositories-routes.ts`
- Modify `packages/server/tests/github-repositories-routes.test.ts`

- [ ] **Step 1: Update server API types**

In `packages/server/src/http/types/github-repositories-api.types.ts`, remove the `GitHubRepositoryCommandRunner` export and add:

```ts
export interface GitHubConnectionResponse {
	isConfigured: boolean;
	isConnected: boolean;
	login: string | null;
	unavailableReason: string | null;
}

export interface GitHubRepositoriesRouteDeps {
	env?: Record<string, string | undefined>;
	fetchFn?: typeof fetch;
	loadEnv?: (cwd: string) => Promise<Record<string, string> | undefined>;
	randomState?: () => string;
	saveEnv?: (
		cwd: string,
		updates: Record<string, string | undefined>,
	) => Promise<void>;
}
```

- [ ] **Step 2: Update route dependencies**

In `github-repositories-routes.ts`, import `loadSqliteEnv` and `saveSqliteEnv` from `devos/features/config`. Make the handler signature:

```ts
export async function handleGitHubRepositoriesRoute(
	request: Request,
	pathname: string,
	workspacePath: string,
	deps: GitHubRepositoriesRouteDeps = {},
): Promise<Response | null>
```

Resolve dependencies with:

```ts
const env = deps.env ?? process.env;
const fetchFn = deps.fetchFn ?? fetch;
const loadEnv = deps.loadEnv ?? loadSqliteEnv;
const saveEnv = deps.saveEnv ?? saveSqliteEnv;
const randomState = deps.randomState ?? crypto.randomUUID;
```

- [ ] **Step 3: Implement route dispatch**

Handle exact paths:
- `GET /api/github/connection`
- `DELETE /api/github/connection`
- `GET /api/github/oauth/start`
- `GET /api/github/oauth/callback`
- `GET /api/github/repositories`

Return `null` for all other paths. Use `methodNotAllowed()` for known paths with unsupported methods.

- [ ] **Step 4: Implement configuration and connection helpers**

Use these constants:

```ts
const CLIENT_ID_KEY = "GITHUB_OAUTH_CLIENT_ID";
const CLIENT_SECRET_KEY = "GITHUB_OAUTH_CLIENT_SECRET";
const TOKEN_KEY = "GITHUB_OAUTH_ACCESS_TOKEN";
const LOGIN_KEY = "GITHUB_OAUTH_LOGIN";
const STATE_COOKIE = "devos_github_oauth_state";
```

Configuration comes from `deps.env ?? process.env`. Stored token/login come from `loadEnv(workspacePath)`. Treat empty strings as missing.

Connection response rules:
- Unconfigured: `isConfigured: false`, `isConnected: false`, `login: null`, `unavailableReason: "GitHub OAuth is not configured"`.
- Configured but disconnected: `isConfigured: true`, `isConnected: false`, `login: null`, `unavailableReason: "Connect GitHub to list repositories"`.
- Connected: `isConfigured: true`, `isConnected: true`, `login`, `unavailableReason: null`.

- [ ] **Step 5: Implement OAuth start**

Generate a state string, derive callback URL with:

```ts
const redirectUri = new URL("/api/github/oauth/callback", request.url);
```

Redirect to GitHub with `client_id`, `redirect_uri`, `scope=repo`, and `state`.

Set the state cookie:

```ts
`${STATE_COOKIE}=${state}; HttpOnly; SameSite=Lax; Path=/api/github/oauth; Max-Age=600`
```

If OAuth is unconfigured, return `Response.json(connectionResponse, { status: 503 })`.

- [ ] **Step 6: Implement OAuth callback**

Validate `code`, query `state`, and state cookie. On invalid input, return status `400` with a generic JSON error and do not store anything.

Exchange the code:

```ts
await fetchFn("https://github.com/login/oauth/access_token", {
	method: "POST",
	headers: {
		accept: "application/json",
		"content-type": "application/json",
	},
	body: JSON.stringify({
		client_id: config.clientId,
		client_secret: config.clientSecret,
		code,
		redirect_uri: redirectUri.toString(),
	}),
});
```

Fetch the user:

```ts
await fetchFn("https://api.github.com/user", {
	headers: {
		accept: "application/vnd.github+json",
		authorization: `Bearer ${token}`,
	},
});
```

Persist only:

```ts
await saveEnv(workspacePath, {
	GITHUB_OAUTH_ACCESS_TOKEN: token,
	GITHUB_OAUTH_LOGIN: login,
});
```

Redirect to `/projects?github=connected` and clear the state cookie. On exchange/user failure, clear the cookie and redirect to `/projects?github=error`.

- [ ] **Step 7: Implement disconnect**

`DELETE /api/github/connection` clears `TOKEN_KEY` and `LOGIN_KEY` through `saveEnv`, then returns the disconnected connection response. Do not call GitHub revoke in this first version.

- [ ] **Step 8: Implement REST repository listing**

When connected, call:

```ts
https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member
```

Headers:

```ts
{
	accept: "application/vnd.github+json",
	authorization: `Bearer ${token}`,
}
```

Map valid rows into existing `GitHubRepositoryRecord` fields:
- `id`: string form of GitHub numeric id, falling back to `full_name` only if id is absent.
- `owner`: `owner.login` when string.
- `name`: repository name.
- `nameWithOwner`: `full_name`.
- `defaultBranch`: `default_branch` when string, else null.
- `isPrivate`: `private === true`.

Sort order should remain GitHub's returned order.

- [ ] **Step 9: Preserve public response shape**

Keep `GET /api/github/repositories` response compatible with the existing web client:

```ts
export interface GitHubRepositoriesResponse {
	isAvailable: boolean;
	unavailableReason: string | null;
	repositories: GitHubRepositoryRecord[];
}
```

Do not include token, scopes, OAuth code, or raw GitHub error body in any response.

- [ ] **Step 10: Run focused server tests and confirm GREEN**

Run:

```bash
bun test packages/server/tests/github-repositories-routes.test.ts
```

Expected: all server OAuth route tests pass.

- [ ] **Step 11: Commit server slice**

Run:

```bash
rtk git status --short
rtk git add packages/server/src/http/github-repositories-routes.ts packages/server/src/http/types/github-repositories-api.types.ts packages/server/tests/github-repositories-routes.test.ts
rtk git commit -m "feat(server): add github oauth repository listing"
```

### Task 3: Add Web API Client and Query Support

**Files:**
- Modify `packages/web/src/lib/api/types/client.types.ts`
- Modify `packages/web/src/lib/api/github-client.ts`
- Modify `packages/web/src/lib/api/query-keys.ts`
- Modify `packages/web/src/lib/api/realtime-queries.ts`
- Modify `packages/web/tests/github-repositories-client.test.ts`

- [ ] **Step 1: Add failing client tests**

Extend `packages/web/tests/github-repositories-client.test.ts`.

Connection test:

```ts
it("reads GitHub connection state", async () => {
	const fetchFn = (async (input: URL | RequestInfo, init?: RequestInit) => {
		expect(String(input)).toBe("/api/github/connection");
		expect(init?.method).toBe("GET");
		return okJsonResponse({
			isConfigured: true,
			isConnected: true,
			login: "octo",
			unavailableReason: null,
		});
	}) as typeof fetch;

	await expect(createApiClient({ fetchFn }).getGitHubConnection()).resolves.toEqual({
		isConfigured: true,
		isConnected: true,
		login: "octo",
		unavailableReason: null,
	});
});
```

Disconnect test:

```ts
it("disconnects GitHub", async () => {
	const fetchFn = (async (input: URL | RequestInfo, init?: RequestInit) => {
		expect(String(input)).toBe("/api/github/connection");
		expect(init?.method).toBe("DELETE");
		return okJsonResponse({
			isConfigured: true,
			isConnected: false,
			login: null,
			unavailableReason: "Connect GitHub to list repositories",
		});
	}) as typeof fetch;

	await expect(createApiClient({ fetchFn }).disconnectGitHub()).resolves.toEqual({
		isConfigured: true,
		isConnected: false,
		login: null,
		unavailableReason: "Connect GitHub to list repositories",
	});
});
```

- [ ] **Step 2: Run web client tests and confirm RED**

Run:

```bash
bun test packages/web/tests/github-repositories-client.test.ts
```

Expected: tests fail because `getGitHubConnection` and `disconnectGitHub` do not exist.

- [ ] **Step 3: Add web types and parser**

In `client.types.ts`, add:

```ts
export interface GitHubConnectionResponse {
	isConfigured: boolean;
	isConnected: boolean;
	login: string | null;
	unavailableReason: string | null;
}
```

In `github-client.ts`, add:
- `const GITHUB_CONNECTION_PATH = "/api/github/connection";`
- `parseGitHubConnectionResponse(payload: unknown): GitHubConnectionResponse`
- Methods:

```ts
getGitHubConnection(options?: HealthRequestOptions): Promise<GitHubConnectionResponse>;
disconnectGitHub(options?: HealthRequestOptions): Promise<GitHubConnectionResponse>;
```

- [ ] **Step 4: Add query support**

Add `gitHubConnection: ["server-state", "github-connection"] as const` to `serverStateQueryKeys`.

Add `useGitHubConnectionQuery` to `realtime-queries.ts`:

```ts
export function useGitHubConnectionQuery(
	options?: ServerStateQueryOptions,
): UseQueryResult<GitHubConnectionResponse, Error> {
	return useQuery({
		queryKey: serverStateQueryKeys.gitHubConnection,
		queryFn: () => apiClient.getGitHubConnection(),
		enabled: options?.enabled !== false,
		refetchInterval: resolveRefetchInterval(options),
	});
}
```

- [ ] **Step 5: Run focused web client tests and confirm GREEN**

Run:

```bash
bun test packages/web/tests/github-repositories-client.test.ts
```

Expected: tests pass.

### Task 4: Update Projects Repository Selector UX

**Files:**
- Modify `packages/web/src/components/projects/projects-panel-utils.ts`
- Modify `packages/web/tests/projects-panel-utils.test.ts`
- Modify `packages/web/src/components/projects/project-create-dialog-fields.tsx`
- Modify `packages/web/src/components/projects/project-create-dialog.tsx`
- Modify `packages/web/src/components/projects/projects-panel.tsx`

- [ ] **Step 1: Add failing pure helper tests**

Add a helper such as `resolveRepositorySelectorState` in `projects-panel-utils.ts` so repository UI decisions are testable without component tests.

Expected helper inputs:

```ts
interface RepositorySelectorStateInput {
	connection?: GitHubConnectionResponse;
	hasRepositoryOptions: boolean;
	isRepositoryLoading: boolean;
	isRepositoryError: boolean;
	repositoryUnavailableReason: string | null;
}
```

Expected output:

```ts
interface RepositorySelectorState {
	canSelectRepository: boolean;
	shouldShowConnect: boolean;
	shouldShowRetry: boolean;
	statusMessage: string | null;
}
```

Test cases:
- Unconfigured: cannot select, no connect button, status `GitHub OAuth is not configured; manual entry is still available.`
- Configured/disconnected: cannot select, show connect, status `Connect GitHub to list repositories.`
- Connected/loading: cannot select, no connect, status `Loading repositories.`
- Connected/loaded with options: can select, no message.
- Connected/error: cannot select, show retry, status `GitHub repositories unavailable; manual entry is still available.`

- [ ] **Step 2: Run helper tests and confirm RED**

Run:

```bash
bun test packages/web/tests/projects-panel-utils.test.ts
```

Expected: tests fail because the selector state helper does not exist.

- [ ] **Step 3: Implement selector helper**

Keep the helper pure and colocated with other Projects panel helpers. Do not import React in `projects-panel-utils.ts`.

- [ ] **Step 4: Update `RepositoryFields` props**

Extend `RepositoryFields` to accept:

```ts
connection: GitHubConnectionResponse | undefined;
isRepositoryError: boolean;
onConnectGitHub: () => void;
onRetryRepositories: () => void;
```

Use the helper output to:
- Disable the select when `canSelectRepository` is false.
- Show a `Connect GitHub` button when `shouldShowConnect` is true.
- Show a `Retry` button when `shouldShowRetry` is true.
- Always keep the Manual mode button available.
- Keep the existing platform styling: same `Button`, `Input`, `Typography`, border, spacing, and muted description language.

Use `Github` or `FolderGit` from `lucide-react` for the connect button icon. Do not add new visual systems.

- [ ] **Step 5: Update dialog props**

Pass connection and callbacks through `project-create-dialog.tsx` without changing the existing create/edit form model.

- [ ] **Step 6: Update Projects panel queries and handlers**

In `projects-panel.tsx`:
- Query connection while the create/edit dialog is open.
- Query repositories only when the dialog is open and `connection.data?.isConnected === true`.
- Use `refetchIntervalMs: false` for both queries.
- Set `onConnectGitHub` to:

```ts
window.location.assign("/api/github/oauth/start");
```

- Set retry to `githubRepositoriesQuery.refetch()`.
- After disconnect is implemented in the API client, do not add a disconnect button in this task unless the existing dialog has an obvious place for it. This first UX only needs connect and retry.

- [ ] **Step 7: Run focused web tests and confirm GREEN**

Run:

```bash
bun test packages/web/tests/projects-panel-utils.test.ts packages/web/tests/github-repositories-client.test.ts
```

Expected: tests pass.

### Task 5: Full Verification and Browser Check

**Files:**
- No planned source edits unless verification exposes a scoped issue.

- [ ] **Step 1: Run package-level checks**

Run focused checks first:

```bash
bun test packages/server/tests/github-repositories-routes.test.ts packages/web/tests/github-repositories-client.test.ts packages/web/tests/projects-panel-utils.test.ts
```

Then run required repo gates if the focused checks pass:

```bash
bun run check
bun run typecheck
bun test
```

If a repo-wide gate fails for unrelated pre-existing reasons, capture the exact failing command and the smallest relevant output.

- [ ] **Step 2: Run the app for local browser verification**

Start the dev server with the repo's existing Bun command. If the current port is busy, use an available port and report the URL.

Verify in the in-app browser:
- Projects create dialog opens.
- Repository Select mode shows `Connect GitHub` when OAuth is configured but disconnected.
- Manual mode remains usable.
- With a mocked or local connected store, repository select enables and shows repo options.
- No button text overflows and the UI still matches the platform operator style.

- [ ] **Step 3: Final status check**

Run:

```bash
rtk git status --short --branch
```

Confirm only planned files changed.

- [ ] **Step 4: Commit remaining web slice**

If all focused checks pass, commit the web and verification slice:

```bash
rtk git add packages/web/src/lib/api/types/client.types.ts packages/web/src/lib/api/github-client.ts packages/web/src/lib/api/query-keys.ts packages/web/src/lib/api/realtime-queries.ts packages/web/tests/github-repositories-client.test.ts packages/web/src/components/projects/projects-panel-utils.ts packages/web/tests/projects-panel-utils.test.ts packages/web/src/components/projects/project-create-dialog-fields.tsx packages/web/src/components/projects/project-create-dialog.tsx packages/web/src/components/projects/projects-panel.tsx
rtk git commit -m "feat(web): connect projects to github oauth"
```

### Risk Notes

- OAuth client id and secret must come from environment variables and must not be written to tracked files.
- The access token is stored in the local devos `env.sqlite` through `saveSqliteEnv`; do not print it or expose it in API responses.
- Repository listing switches from `gh repo list` to GitHub REST only after OAuth connection exists. Manual owner/repo entry remains the fallback.
- This first version does not revoke the token at GitHub on disconnect; it only clears local storage.
- Workflow GitHub operations continue to use their existing implementation and are not changed by this plan.

