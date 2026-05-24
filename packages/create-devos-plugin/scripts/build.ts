import { chmod, rm } from "node:fs/promises";
import path from "node:path";

const packageRoot = path.resolve(import.meta.dir, "..");

async function build(): Promise<void> {
	const outdir = path.join(packageRoot, "dist");
	await rm(outdir, { recursive: true, force: true });
	const result = await Bun.build({
		entrypoints: [path.join(packageRoot, "src/index.ts")],
		naming: { entry: "[name].[ext]" },
		root: packageRoot,
		target: "bun",
		outdir,
	});
	if (!result.success) {
		throw new Error(result.logs.map((log) => log.message).join("\n"));
	}
	await chmod(path.join(outdir, "index.js"), 0o755);
}

await build();
