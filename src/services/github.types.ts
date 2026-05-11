import type { assertCommandOk, runCommand } from "../utils/shell";

export interface GithubCommandDeps {
	runCommand?: typeof runCommand;
	assertCommandOk?: typeof assertCommandOk;
}

export interface PrListEntry {
	number?: number;
	url?: string;
	title?: string;
	headRefName?: string;
}
