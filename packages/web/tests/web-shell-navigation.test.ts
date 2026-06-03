import { describe, expect, it } from "bun:test";

import {
	hrefForNavKey,
	navItems,
} from "../src/components/web-shell/web-shell.constants";

describe("web shell navigation", () => {
	it("shows Git in workspace navigation and routes it to the Git instructions page", () => {
		expect(navItems).toContainEqual({
			key: "git",
			label: "Git",
			href: "/git",
		});
		expect(hrefForNavKey("git")).toBe("/git");
	});

	it("shows Issues in workspace navigation and routes it to the task board", () => {
		expect(navItems).toContainEqual({
			key: "issues",
			label: "Issues",
			href: "/issues",
		});
		expect(hrefForNavKey("issues")).toBe("/issues");
	});
});
