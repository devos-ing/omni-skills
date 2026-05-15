import { spawn } from "node:child_process";

const commands = [
	["bun", ["run", "dev:server"], {}],
	["bun", ["run", "dev:web"], { PORT: "3000" }],
] as const;

const children = commands.map(([command, args, env]) =>
	spawn(command, args, {
		stdio: "inherit",
		env: { ...process.env, ...env },
	}),
);

let isShuttingDown = false;

const shutdown = (signal?: NodeJS.Signals) => {
	if (isShuttingDown) {
		return;
	}

	isShuttingDown = true;

	for (const child of children) {
		if (!child.killed) {
			child.kill(signal ?? "SIGTERM");
		}
	}
};

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.on(signal, () => {
		shutdown(signal);
		process.exit(0);
	});
}

for (const child of children) {
	child.on("exit", (code, signal) => {
		if (isShuttingDown) {
			return;
		}

		shutdown(signal ?? undefined);
		process.exit(code ?? (signal ? 1 : 0));
	});
}
