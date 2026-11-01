import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { logger } from '../logger.js';
import type { AgentAdapter, AgentCapabilities, DetectionResult, InstallResult } from './types.js';

const PROVIDER_ID = 'codex';
const PROVIDER_NAME = 'OpenAI Codex';
const ADAPTER_VERSION = '1.0.0';

const HOOK_EVENTS = [
  'PreToolUse', 'PostToolUse', 'PermissionRequest',
  'SessionStart', 'SessionEnd', 'Stop', 'Interrupt',
];

function getSettingsFilePath(): string {
  return path.join(os.homedir(), '.codex', 'hooks.json');
}

export class CodexAdapter implements AgentAdapter {
  readonly providerId = PROVIDER_ID;
  readonly providerName = PROVIDER_NAME;
  readonly adapterVersion = ADAPTER_VERSION;

  detect(): DetectionResult {
    try {
      const cmd = process.platform === 'win32' ? 'where codex' : 'which codex';
      const result = execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim();
      let version: string | undefined;
      try {
        version = execSync('codex --version', { encoding: 'utf-8', timeout: 5000 }).trim();
      } catch { /* optional */ }
      return { installed: true, path: result.split('\n')[0], version };
    } catch {
      return { installed: false };
    }
  }

  getHooksConfig(hooksPort = 8765): Record<string, unknown> {
    const baseUrl = `http://127.0.0.1:${hooksPort}`;
    return {
      PreToolUse: [{
        matcher: '',
        hooks: [{ type: 'http', url: `${baseUrl}/hooks`, timeout: 300 }],
      }],
      PostToolUse: [{
        matcher: '',
        hooks: [{ type: 'http', url: `${baseUrl}/hooks`, timeout: 10 }],
      }],
      SessionStart: [{
        hooks: [{ type: 'http', url: `${baseUrl}/hooks`, timeout: 10 }],
      }],
      SessionEnd: [{
        hooks: [{ type: 'http', url: `${baseUrl}/hooks`, timeout: 10 }],
      }],
      Stop: [{
        hooks: [{ type: 'http', url: `${baseUrl}/hooks`, timeout: 10 }],
      }],
    };
  }

  install(hooksPort = 8765): InstallResult {
    const settingsPath = getSettingsFilePath();
    const dir = path.dirname(settingsPath);
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      let hooks: Record<string, unknown> = {};
      if (fs.existsSync(settingsPath)) {
        hooks = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as Record<string, unknown>;
      }
      Object.assign(hooks, this.getHooksConfig(hooksPort));
      fs.writeFileSync(settingsPath, JSON.stringify(hooks, null, 2), 'utf-8');
      logger.info('adapter_hooks_installed', { provider: PROVIDER_ID, path: settingsPath });
      return { success: true, settingsPath };
    } catch (err) {
      return { success: false, settingsPath, error: err instanceof Error ? err.message : String(err) };
    }
  }

  uninstall(): { success: boolean; error?: string } {
    const settingsPath = getSettingsFilePath();
    try {
      if (!fs.existsSync(settingsPath)) return { success: true };
      const hooks = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as Record<string, unknown>;
      for (const name of HOOK_EVENTS) delete hooks[name];
      if (Object.keys(hooks).length === 0) {
        fs.unlinkSync(settingsPath);
      } else {
        fs.writeFileSync(settingsPath, JSON.stringify(hooks, null, 2), 'utf-8');
      }
      logger.info('adapter_hooks_uninstalled', { provider: PROVIDER_ID });
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  getCapabilities(): AgentCapabilities {
    return {
      sessionDiscovery: true,
      sessionStatus: true,
      toolActivity: true,
      permissionObservation: true,
      permissionInterception: true,
      remoteApprovalResolution: true,
      messageInjection: false,
      sessionInterruption: false,
      sessionTermination: false,
      fileChangeObservation: true,
      structuredErrors: true,
    };
  }

  async healthCheck(hooksPort = 8765): Promise<boolean> {
    try {
      const resp = await fetch(`http://127.0.0.1:${hooksPort}/hooks/health`, { signal: AbortSignal.timeout(2000) });
      return resp.ok;
    } catch {
      return false;
    }
  }

  getSettingsPath(): string {
    return getSettingsFilePath();
  }

  getHookEventNames(): string[] {
    return [...HOOK_EVENTS];
  }
}
