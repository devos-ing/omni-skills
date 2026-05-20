import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

export const PGLITE_RUNTIME_ASSETS = ["pglite.data", "pglite.wasm"] as const;

interface BuildCliPackageOptions {
	entrypoint?: string;
	outdir?: string;
}

const packageRoot = path.resolve(import.meta.dir, "..");
const serverDatabaseExport = "devos-server/db";

export async function buildCliPackage(
	options: BuildCliPackageOptions = {},
): Promise<void> {
	const outdir = options.outdir ?? path.join(packageRoot, "dist");
	const result = await Bun.build({
		entrypoints: [options.entrypoint ?? path.join(packageRoot, "src/index.ts")],
		target: "bun",
		outdir,
	});
	if (!result.success) {
		throw new Error(formatBuildErrors(result.logs));
	}
	await copyPgliteRuntimeAssets(outdir);
}

export async function copyPgliteRuntimeAssets(outdir: string): Promise<void> {
	await mkdir(outdir, { recursive: true });
	for (const asset of await resolvePgliteRuntimeAssets()) {
		await copyFile(asset.path, path.join(outdir, asset.fileName));
	}
}

export async function resolvePgliteRuntimeAssets(): Promise<
	Array<{ fileName: (typeof PGLITE_RUNTIME_ASSETS)[number]; path: string }>
> {
	const pgliteEntry = await resolvePglitePackageEntry();
	const pgliteDist = path.dirname(pgliteEntry);
	return PGLITE_RUNTIME_ASSETS.map((fileName) => ({
		fileName,
		path: path.join(pgliteDist, fileName),
	}));
}

export async function resolvePglitePackageEntry(
	resolveModule: (specifier: string, parent: string) => Promise<string> = (
		specifier,
		parent,
	) => Bun.resolve(specifier, parent),
): Promise<string> {
	const serverDbEntry = await resolveModule(serverDatabaseExport, packageRoot);
	return resolveModule("@electric-sql/pglite", serverDbEntry);
}

function formatBuildErrors(logs: Array<{ message: string }>): string {
	const message = logs
		.map((log) => log.message)
		.join("\n")
		.trim();
	return message || "CLI build failed";
}

if (import.meta.main) {
	await buildCliPackage();
}
