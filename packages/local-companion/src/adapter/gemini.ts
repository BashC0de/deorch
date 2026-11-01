import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { logger } from '../logger.js';
import type { AgentAdapter, AgentCapabilities, DetectionResult, InstallResult } from './types.js';

const PROVIDER_ID = 'gemini';
const PROVIDER_NAME = 'Gemini CLI';
const ADAPTER_VERSION = '1.0.0';

const HOOK_EVENTS = [
  'PreToolUse', 'PostToolUse', 'SessionStart', 'Stop',
];

function getExtensionDir(): string {
  return path.join(os.homedir(), '.gemini', 'extensions', 'deorch');
}

function getHooksFilePath(): string {
  return path.join(getExtensionDir(), 'hooks', 'hooks.json');
}

export class GeminiAdapter implements AgentAdapter {
  readonly providerId = PROVIDER_ID;
  readonly providerName = PROVIDER_NAME;
  readonly adapterVersion = ADAPTER_VERSION;

  detect(): DetectionResult {
    try {
      const cmd = process.platform === 'win32' ? 'where gemini' : 'which gemini';
      const result = execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim();
      let version: string | undefined;
      try {
        version = execSync('gemini --version', { encoding: 'utf-8', timeout: 5000 }).trim();
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
      Stop: [{
        hooks: [{ type: 'http', url: `${baseUrl}/hooks`, timeout: 10 }],
      }],
    };
  }

  install(hooksPort = 8765): InstallResult {
    const hooksPath = getHooksFilePath();
    const extDir = getExtensionDir();
    const hooksDir = path.join(extDir, 'hooks');
    try {
      if (!fs.existsSync(hooksDir)) fs.mkdirSync(hooksDir, { recursive: true });

      // Write extension manifest
      const manifest = {
        name: 'deorch',
        displayName: 'DeOrch Remote Approval',
        version: ADAPTER_VERSION,
        description: 'Remote approval and observability for Gemini CLI via DeOrch',
      };
      fs.writeFileSync(path.join(extDir, 'extension.json'), JSON.stringify(manifest, null, 2), 'utf-8');

      // Write hooks config
      fs.writeFileSync(hooksPath, JSON.stringify(this.getHooksConfig(hooksPort), null, 2), 'utf-8');
      logger.info('adapter_hooks_installed', { provider: PROVIDER_ID, path: hooksPath });
      return { success: true, settingsPath: hooksPath };
    } catch (err) {
      return { success: false, settingsPath: hooksPath, error: err instanceof Error ? err.message : String(err) };
    }
  }

  uninstall(): { success: boolean; error?: string } {
    const extDir = getExtensionDir();
    try {
      if (fs.existsSync(extDir)) {
        fs.rmSync(extDir, { recursive: true, force: true });
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
      fileChangeObservation: false,
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
    return getHooksFilePath();
  }

  getHookEventNames(): string[] {
    return [...HOOK_EVENTS];
  }
}
