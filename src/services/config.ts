import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { parse as parseYaml } from "yaml";
import { ReplicantConfig, DEFAULT_CONFIG, UiConfig, BuildConfig } from "../types/config.js";
import { logger } from "../utils/logger.js";

/**
 * Load configuration from REPLICANT_CONFIG environment variable path
 * Falls back to defaults if not set or file doesn't exist
 */
export async function loadConfig(): Promise<ReplicantConfig> {
  const configPath = process.env.REPLICANT_CONFIG;

  if (!configPath) {
    return DEFAULT_CONFIG;
  }

  if (!existsSync(configPath)) {
    logger.warn("REPLICANT_CONFIG set but file not found", { path: configPath });
    return DEFAULT_CONFIG;
  }

  try {
    const content = await readFile(configPath, "utf-8");
    const parsed = parseYaml(content) as Partial<ReplicantConfig> | null;

    if (!parsed) {
      return DEFAULT_CONFIG;
    }

    // Deep merge with defaults
    return {
      ui: mergeUiConfig(DEFAULT_CONFIG.ui, parsed.ui),
      build: mergeBuildConfig(DEFAULT_CONFIG.build, parsed.build),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("Failed to parse REPLICANT_CONFIG", { path: configPath, error: message });
    return DEFAULT_CONFIG;
  }
}

function mergeBuildConfig(defaults: BuildConfig, overrides?: Partial<BuildConfig>): BuildConfig {
  if (!overrides) {
    return defaults;
  }

  return {
    projectRoot: overrides.projectRoot ?? defaults.projectRoot,
  };
}

function mergeUiConfig(defaults: UiConfig, overrides?: Partial<UiConfig>): UiConfig {
  if (!overrides) {
    return defaults;
  }

  return {
    visualModePackages: overrides.visualModePackages ?? defaults.visualModePackages,
    autoFallbackScreenshot: overrides.autoFallbackScreenshot ?? defaults.autoFallbackScreenshot,
    includeBase64: overrides.includeBase64 ?? defaults.includeBase64,
    maxImageDimension: overrides.maxImageDimension ?? defaults.maxImageDimension,
  };
}

/**
 * ConfigManager holds the loaded configuration and provides access to it
 */
export class ConfigManager {
  private config: ReplicantConfig = DEFAULT_CONFIG;

  async load(): Promise<void> {
    this.config = await loadConfig();
  }

  get(): ReplicantConfig {
    return this.config;
  }

  getUiConfig(): UiConfig {
    return this.config.ui;
  }

  getBuildConfig(): BuildConfig {
    return this.config.build;
  }

  isVisualModePackage(packageName: string): boolean {
    return this.config.ui.visualModePackages.includes(packageName);
  }
}
