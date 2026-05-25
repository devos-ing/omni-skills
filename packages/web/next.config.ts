import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const serverBaseUrl =
	process.env.DEVOS_SERVER_BASE_URL ?? "http://127.0.0.1:3001";
const workspaceRoot = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);

const nextConfig: NextConfig = {
	allowedDevOrigins: ["127.0.0.1"],
	reactStrictMode: true,
	turbopack: {
		root: workspaceRoot,
	},
	async rewrites() {
		return [
			{
				source: "/api/:path*",
				destination: `${serverBaseUrl}/api/:path*`,
			},
			{
				source: "/health",
				destination: `${serverBaseUrl}/health`,
			},
		];
	},
};

export default nextConfig;
