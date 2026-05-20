import { readFile } from "node:fs/promises";

export async function readOutputFile(file: string): Promise<string> {
	try {
		return (await readFile(file, "utf8")).trim();
	} catch {
		return "";
	}
}
