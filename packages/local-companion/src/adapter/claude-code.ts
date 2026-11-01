import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { logger } from '../logger.js';
import type { AgentAdapter, AgentCapabilities, DetectionResult, InstallResult } from './types.js';

const PROVIDER_ID = 'claude-code';
const PROVIDER_NAME = 'Claude Code';
const ADAPTER_VERSION = '1.0.0';

const HOOK_EVENTS = [
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
  'SessionStart', 'Stop', 'Notification',
];

function getSettingsFilePath(): string {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

export class ClaudeCodeAdapter implements AgentAdapter {
  readonly providerId = PROVIDER_ID;
  readonly providerName = PROVIDER_NAME;
  readonly adapterVersion = ADAPTER_VERSION;

  detect(): DetectionResult {
    try {
      const cmd = process.platform === 'win32' ? 'where claude' : 'which claude';
      const result = execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim();
      let version: string | undefined;
      try {
        version = execSync('claude --version', { encoding: 'utf-8', timeout: 5000 }).trim();
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
        hooks: [{ type: 'http', url: `${baseUrl}/hooks`, timeout: 300, statusMessage: 'Checking DeOrch approval...' }],
      }],
      PostToolUse: [{
        matcher: '',
        hooks: [{ type: 'http', url: `${baseUrl}/hooks`, timeout: 10 }],
      }],
      PostToolUseFailure: [{
        matcher: '',
        hooks: [{ type: 'http', url: `${baseUrl}/hooks`, timeout: 10 }],
      }],
      SessionStart: [{
        hooks: [{ type: 'http', url: `${baseUrl}/hooks`, timeout: 10 }],
      }],
      Stop: [{
        hooks: [{ type: 'http', url: `${baseUrl}/hooks`, timeout: 10 }],
      }],
      Notification: [{
        hooks: [{ type: 'http', url: `${baseUrl}/hooks`, timeout: 10 }],
      }],
    };
  }

  install(hooksPort = 8765): InstallResult {
    const settingsPath = getSettingsFilePath();
    const dir = path.dirname(settingsPath);
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      let settings: Record<string, unknown> = {};
      if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as Record<string, unknown>;
      }
      settings['hooks'] = { ...(settings['hooks'] as Record<string, unknown> ?? {}), ...this.getHooksConfig(hooksPort) };
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
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
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as Record<string, unknown>;
      const hooks = settings['hooks'] as Record<string, unknown> | undefined;
      if (hooks) {
        for (const name of HOOK_EVENTS) delete hooks[name];
        if (Object.keys(hooks).length === 0) delete settings['hooks'];
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
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
