/**
 * Universal Agent Adapter Contract
 *
 * Every provider adapter implements this interface. The contract is designed
 * for hook-based CLI agents (Claude Code, Codex, Gemini CLI) but extensible
 * to other integration patterns.
 */

export interface AgentCapabilities {
  sessionDiscovery: boolean;
  sessionStatus: boolean;
  toolActivity: boolean;
  permissionObservation: boolean;
  permissionInterception: boolean;
  remoteApprovalResolution: boolean;
  messageInjection: boolean;
  sessionInterruption: boolean;
  sessionTermination: boolean;
  fileChangeObservation: boolean;
  structuredErrors: boolean;
}

export type CapabilityStatus =
  | 'IMPLEMENTED_AND_VERIFIED'
  | 'IMPLEMENTED_BUT_LIMITED'
  | 'DOCUMENTED_BUT_UNSUPPORTED'
  | 'NOT_IMPLEMENTED'
  | 'NOT_APPLICABLE';

export interface DetectionResult {
  installed: boolean;
  path?: string;
  version?: string;
}

export interface InstallResult {
  success: boolean;
  settingsPath: string;
  error?: string;
}

export interface AgentAdapter {
  readonly providerId: string;
  readonly providerName: string;
  readonly adapterVersion: string;

  /** Detect if the provider CLI is installed */
  detect(): DetectionResult;

  /** Generate hook configuration for this provider */
  getHooksConfig(hooksPort: number): Record<string, unknown>;

  /** Install DeOrch hooks into the provider's configuration */
  install(hooksPort: number): InstallResult;

  /** Remove DeOrch hooks from the provider's configuration */
  uninstall(): { success: boolean; error?: string };

  /** Return supported capabilities */
  getCapabilities(): AgentCapabilities;

  /** Check if the hooks server is reachable */
  healthCheck(hooksPort: number): Promise<boolean>;

  /** Return the settings file path for this provider */
  getSettingsPath(): string;

  /** Provider-specific hook event names (for display/logging) */
  getHookEventNames(): string[];
}

/**
 * Adapter Registry — manages all provider adapters
 */
export class AdapterRegistry {
  private adapters = new Map<string, AgentAdapter>();

  register(adapter: AgentAdapter): void {
    this.adapters.set(adapter.providerId, adapter);
  }

  get(providerId: string): AgentAdapter | undefined {
    return this.adapters.get(providerId);
  }

  list(): AgentAdapter[] {
    return [...this.adapters.values()];
  }

  getInstalled(): AgentAdapter[] {
    return this.list().filter((a) => a.detect().installed);
  }

  has(providerId: string): boolean {
    return this.adapters.has(providerId);
  }
}
