/**
 * Configuration types for replicant-mcp
 * Loaded from REPLICANT_CONFIG environment variable path
 */

export interface UiConfig {
  /** Always skip accessibility and use visual mode for these packages */
  visualModePackages: string[];
  /** Auto-include screenshot when find returns no results (default: true) */
  autoFallbackScreenshot: boolean;
  /** Include base64-encoded screenshot in response (default: false) */
  includeBase64: boolean;
  /** Maximum dimension (width or height) for screenshots in pixels (default: 800) */
  maxImageDimension: number;
}

export interface ReplicantConfig {
  ui: UiConfig;
}

export const DEFAULT_CONFIG: ReplicantConfig = {
  ui: {
    visualModePackages: [],
    autoFallbackScreenshot: true,
    includeBase64: false,
    maxImageDimension: 800,
  },
};

/**
 * Visual snapshot response returned when accessibility fails
 * or when visual-snapshot operation is explicitly requested
 */
export interface VisualSnapshot {
  screenshotPath: string;
  screenshotBase64?: string;
  screen: {
    width: number;
    height: number;
    density: number;
  };
  app: {
    packageName: string;
    activityName: string;
  };
  hint?: string;
}
