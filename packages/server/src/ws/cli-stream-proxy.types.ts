import type { Server } from "node:http";

export interface CliStreamProxyOptions {
	server: Server;
	path: string;
	daemonUrl: string;
}

export interface CliStreamProxy {
	close(): Promise<void>;
}
