import type { LoadedConfig } from "devos/features/config";

export type ServerStartupConfig = Pick<LoadedConfig, "projects">;
