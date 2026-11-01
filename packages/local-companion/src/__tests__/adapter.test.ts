import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getHooksConfig, getCapabilities, SUPPORTED_CAPABILITIES, UNSUPPORTED_CAPABILITIES } from '../adapter/claude-code.js';

describe('Claude Code adapter', () => {
  describe('getHooksConfig', () => {
    it('generates config for all hook events', () => {
      const config = getHooksConfig(8765);
      expect(config).toHaveProperty('PreToolUse');
      expect(config).toHaveProperty('PostToolUse');
      expect(config).toHaveProperty('PostToolUseFailure');
      expect(config).toHaveProperty('SessionStart');
      expect(config).toHaveProperty('Stop');
      expect(config).toHaveProperty('Notification');
    });

    it('uses correct URL with custom port', () => {
      const config = getHooksConfig(9999);
      const preToolUse = config['PreToolUse'] as Array<{ hooks: Array<{ url: string }> }>;
      expect(preToolUse[0].hooks[0].url).toBe('http://127.0.0.1:9999/hooks');
    });

    it('sets 300s timeout for PreToolUse (approval wait)', () => {
      const config = getHooksConfig(8765);
      const preToolUse = config['PreToolUse'] as Array<{ hooks: Array<{ timeout: number }> }>;
      expect(preToolUse[0].hooks[0].timeout).toBe(300);
    });

    it('sets short timeout for observe-only hooks', () => {
      const config = getHooksConfig(8765);
      const postToolUse = config['PostToolUse'] as Array<{ hooks: Array<{ timeout: number }> }>;
      expect(postToolUse[0].hooks[0].timeout).toBe(10);
    });

    it('uses http hook type for all events', () => {
      const config = getHooksConfig(8765);
      for (const [, entries] of Object.entries(config)) {
        const arr = entries as Array<{ hooks: Array<{ type: string }> }>;
        expect(arr[0].hooks[0].type).toBe('http');
      }
    });
  });

  describe('getCapabilities', () => {
    it('returns supported capabilities', () => {
      const caps = getCapabilities();
      expect(caps.supported).toEqual(SUPPORTED_CAPABILITIES);
      expect(caps.supported).toContain('intercept_permission_requests');
      expect(caps.supported).toContain('resolve_permission_requests');
    });

    it('returns unsupported capabilities', () => {
      const caps = getCapabilities();
      expect(caps.unsupported).toEqual(UNSUPPORTED_CAPABILITIES);
      expect(caps.unsupported).toContain('send_follow_up_message');
      expect(caps.unsupported).toContain('stop_session');
    });
  });
});

describe('install/uninstall', () => {
  let tmpDir: string;
  const REAL_HOME = os.homedir();

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deorch-adapter-test-'));
    process.env['HOME'] = tmpDir;
    process.env['USERPROFILE'] = tmpDir;
  });

  afterEach(() => {
    process.env['HOME'] = REAL_HOME;
    process.env['USERPROFILE'] = REAL_HOME;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('install creates settings with hooks', async () => {
    // Dynamic import to pick up mocked HOME
    const { install } = await import('../adapter/claude-code.js');
    const result = install(8765);
    expect(result.success).toBe(true);

    const settingsPath = path.join(tmpDir, '.claude', 'settings.json');
    expect(fs.existsSync(settingsPath)).toBe(true);

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    expect(settings.hooks).toBeDefined();
    expect(settings.hooks.PreToolUse).toBeDefined();
  });

  it('uninstall removes hooks', async () => {
    const { install, uninstall } = await import('../adapter/claude-code.js');
    install(8765);
    const result = uninstall();
    expect(result.success).toBe(true);

    const settingsPath = path.join(tmpDir, '.claude', 'settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    expect(settings.hooks).toBeUndefined();
  });
});
