import path from "node:path";

export const DEFAULT_CONFIG_FILE = "adhd-ai.config.ts";
export const LOCAL_CONFIG_FILE = "adhd-ai.local.config.ts";
export const LEGACY_CONFIG_FILE = "piv-loop.config.ts";

export const SQLITE_ENV_DIR = path.join(".piv-loop", "config");
export const SQLITE_ENV_DB_FILE = "env.sqlite";
export const SQLITE_ENV_TABLE = "env_config";
export const AUTO_SELECT_SKILLS_DB_FILE = "skills.sqlite";
