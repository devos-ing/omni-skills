import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { type OnboardCheck, runOnboardWizard } from "../src/features/onboard";
import type { PromptAdapter } from "../src/features/prompts";
import type { CommandResult } from "../src/utils/shell";
import { renderCliMutedText } from "../src/utils/terminal-format";

let previousHome: string | undefined;

describe("onboard next command", () => {
	afterEach(async () => {
		process.env.HOME = previousHome;
		previousHome = undefined;
	});

	it("prints devos daemon after successful onboard checks", async () => {
		const tempDir = await createTempHome();
		try {
			let output = "";
			await runOnboardWizard(tempDir, {
				runCommand: async () => okCommand(),
				prompts: onboardingPromptAdapter(),
				collectOnboardChecks: async (): Promise<OnboardCheck[]> => [
					{ name: "Instance config", status: "pass", message: "ok" },
				],
				configurePluginCredentials: async () => {},
				write: (chunk) => {
					output += chunk;
				},
			});

			const successIndex = output.indexOf("All checks passed!");
			const daemonIndex = output.indexOf("devos daemon");
			expect(successIndex).toBeGreaterThan(-1);
			expect(daemonIndex).toBeGreaterThan(successIndex);
			// expect(output).toContain("Next command ─┐");
			// expect(output).toContain("│  devos daemon  │");
			// expect(output).toContain("└───────────────┘");
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("formats onboarding description text with the muted CLI style", () => {
		expect(
			renderCliMutedText(
				"devos onboard will configure:",
				(text) => `<gray>${text}</gray>`,
			),
		).toBe("<gray>devos onboard will configure:</gray>");
	});

	it("keeps the onboarding description text in the intro output", async () => {
		const tempDir = await createTempHome();
		try {
			const output = await captureStdout(() =>
				runOnboardWizard(tempDir, {
					runCommand: async () => okCommand(),
					prompts: onboardingPromptAdapter(),
					collectOnboardChecks: async (): Promise<OnboardCheck[]> => [
						{ name: "Instance config", status: "pass", message: "ok" },
					],
					configurePluginCredentials: async () => {},
				}),
			);

			const introLine = "devos onboard will configure:";
			expect(output).toContain(introLine);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});

async function createTempHome(): Promise<string> {
	previousHome = process.env.HOME;
	const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-onboard-home-"));
	process.env.HOME = tempDir;
	return tempDir;
}

function onboardingPromptAdapter(): PromptAdapter {
	return {
		text: async ({ defaultValue }) => defaultValue ?? "",
		password: async () => "",
		confirm: async ({ initialValue }) => initialValue ?? false,
		select: async ({ options, initialValue }) =>
			initialValue ?? options[0]?.value ?? "",
	};
}

function okCommand(): CommandResult {
	return {
		code: 0,
		stdout: "ok",
		stderr: "",
	};
}
