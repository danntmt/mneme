import path from "node:path";
import os from "node:os";
import process from "node:process";

const APP_NAME = "mneme" as const;
const DB_FILENAME = "memory.sqlite" as const;

export type ResolveDatabasePathOptions = {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  homedir?: string;
  cwd?: string;
};

const getPathModule = (platform: NodeJS.Platform): typeof path => {
  return platform === "win32" ? path.win32 : path.posix;
};

const getDataDirectory = (options: ResolveDatabasePathOptions): string => {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const homedir = options.homedir ?? os.homedir();
  const pathModule = getPathModule(platform);

  if (platform === "win32") {
    const localAppData = env.LOCALAPPDATA;
    if (localAppData) return pathModule.join(localAppData, APP_NAME);
    return pathModule.join(homedir, "AppData", "Local", APP_NAME);
  }

  if (platform === "darwin") {
    return pathModule.join(homedir, "Library", "Application Support", APP_NAME);
  }

  const xdgData = env.XDG_DATA_HOME;
  if (xdgData) return pathModule.join(xdgData, APP_NAME);
  return pathModule.join(homedir, ".local", "share", APP_NAME);
};

/**
 * Resolves the database file path.
 *
 * Priority:
 *   1. MNEME_DB_PATH environment variable (explicit override)
 *   2. Platform-standard data directory
 *
 * If MNEME_DB_PATH is a relative path it is resolved against cwd.
 */
export const resolveDatabasePath = (
  options: ResolveDatabasePathOptions = {},
): string => {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const pathModule = getPathModule(platform);
  const cwd = options.cwd ?? process.cwd();
  const envPath = env.MNEME_DB_PATH;
  if (envPath) return pathModule.resolve(cwd, envPath);

  return pathModule.join(getDataDirectory(options), DB_FILENAME);
};
