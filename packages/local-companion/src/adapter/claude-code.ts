import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { logger } from '../logger.js';

export const SUPPORTED_CAPABILITIES = [
  'observe_sessions',
  'observe_tool_activity',
  'intercept_permission_requests',
  'resolve_permission_requests',
  'observe_session_completion',
  'observe_errors',
] as const;

export const UNSUPPORTED_CAPABILITIES = [
  'send_follow_up_message', // No reliable mechanism to inject messages into Claude Code sessions
  'stop_session',           // No supported API to programmatically stop a running session
] as const;

export type Capability = (typeof SUPPORTED_CAPABILITIES)[number];

function getClaudeSettingsPath(): string {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

/**
 * Detect whether Claude Code CLI is installed and available.
 */
export function detect(): { installed: boolean; path?: string; version?: string } {
  try {
    const cmd = process.platform === 'win32' ? 'where claude' : 'which claude';
    const result = execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim();
    let version: string | undefined;
    try {
      version = execSync('claude --version', { encoding: 'utf-8', timeout: 5000 }).trim();
    } catch { /* version detection optional */ }
    return { installed: true, path: result.split('\n')[0], version };
  } catch {
    return { installed: false };
  }
}

/**
 * Generate the hooks configuration for Claude Code settings.json.
 */
export function getHooksConfig(hooksPort = 8765): Record<string, unknown> {
  const baseUrl = `http://127.0.0.1:${hooksPort}`;

  return {
    PreToolUse: [
      {
        matcher: '',
        hooks: [
          {
            type: 'http',
            url: `${baseUrl}/hooks`,
            timeout: 300,
            statusMessage: 'Checking DeOrch approval...',
          },
        ],
      },
    ],
    PostToolUse: [
      {
        matcher: '',
        hooks: [
          {
            type: 'http',
            url: `${baseUrl}/hooks`,
            timeout: 10,
          },
        ],
      },
    ],
    PostToolUseFailure: [
      {
        matcher: '',
        hooks: [
          {
            type: 'http',
            url: `${baseUrl}/hooks`,
            timeout: 10,
          },
        ],
      },
    ],
    SessionStart: [
      {
        hooks: [
          {
            type: 'http',
            url: `${baseUrl}/hooks`,
            timeout: 10,
          },
        ],
      },
    ],
    Stop: [
      {
        hooks: [
          {
            type: 'http',
            url: `${baseUrl}/hooks`,
            timeout: 10,
          },
        ],
      },
    ],
    Notification: [
      {
        hooks: [
          {
            type: 'http',
            url: `${baseUrl}/hooks`,
            timeout: 10,
          },
        ],
      },
    ],
  };
}

/**
 * Install DeOrch hooks into Claude Code's settings.json.
 * Merges with existing hooks rather than overwriting.
 */
export function install(hooksPort = 8765): { success: boolean; settingsPath: string; error?: string } {
  const settingsPath = getClaudeSettingsPath();
  const dir = path.dirname(settingsPath);

  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let settings: Record<string, unknown> = {};
    if (fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, 'utf-8');
      settings = JSON.parse(raw) as Record<string, unknown>;
    }

    const deorchHooks = getHooksConfig(hooksPort);
    settings['hooks'] = {
      ...(settings['hooks'] as Record<string, unknown> ?? {}),
      ...deorchHooks,
    };

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    logger.info('claude_code_hooks_installed', { path: settingsPath });
    return { success: true, settingsPath };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, settingsPath, error: msg };
  }
}

/**
 * Remove DeOrch hooks from Claude Code's settings.json.
 */
export function uninstall(): { success: boolean; error?: string } {
  const settingsPath = getClaudeSettingsPath();

  try {
    if (!fs.existsSync(settingsPath)) {
      return { success: true }; // Nothing to remove
    }

    const raw = fs.readFileSync(settingsPath, 'utf-8');
    const settings = JSON.parse(raw) as Record<string, unknown>;
    const hooks = settings['hooks'] as Record<string, unknown> | undefined;

    if (!hooks) {
      return { success: true };
    }

    // Remove hook entries that point to our companion server
    const deorchEventNames = [
      'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
      'SessionStart', 'Stop', 'Notification',
    ];
    for (const name of deorchEventNames) {
      delete hooks[name];
    }

    if (Object.keys(hooks).length === 0) {
      delete settings['hooks'];
    }

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    logger.info('claude_code_hooks_uninstalled', { path: settingsPath });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Check if the hooks server is reachable.
 */
export async function healthCheck(hooksPort = 8765): Promise<boolean> {
  try {
    const resp = await fetch(`http://127.0.0.1:${hooksPort}/hooks/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export function getCapabilities(): { supported: readonly string[]; unsupported: readonly string[] } {
  return {
    supported: SUPPORTED_CAPABILITIES,
    unsupported: UNSUPPORTED_CAPABILITIES,
  };
}
