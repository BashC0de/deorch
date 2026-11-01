import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ClaudeCodeAdapter } from '../adapter/claude-code.js';
import { CodexAdapter } from '../adapter/codex.js';
import { GeminiAdapter } from '../adapter/gemini.js';
import { AdapterRegistry } from '../adapter/types.js';

describe('ClaudeCodeAdapter', () => {
  const adapter = new ClaudeCodeAdapter();

  describe('getHooksConfig', () => {
    it('generates config for all hook events', () => {
      const config = adapter.getHooksConfig(8765);
      expect(config).toHaveProperty('PreToolUse');
      expect(config).toHaveProperty('PostToolUse');
      expect(config).toHaveProperty('PostToolUseFailure');
      expect(config).toHaveProperty('SessionStart');
      expect(config).toHaveProperty('Stop');
      expect(config).toHaveProperty('Notification');
    });

    it('uses correct URL with custom port', () => {
      const config = adapter.getHooksConfig(9999);
      const preToolUse = config['PreToolUse'] as Array<{ hooks: Array<{ url: string }> }>;
      expect(preToolUse[0]!.hooks[0]!.url).toBe('http://127.0.0.1:9999/hooks');
    });

    it('sets 300s timeout for PreToolUse', () => {
      const config = adapter.getHooksConfig(8765);
      const preToolUse = config['PreToolUse'] as Array<{ hooks: Array<{ timeout: number }> }>;
      expect(preToolUse[0]!.hooks[0]!.timeout).toBe(300);
    });
  });

  describe('getCapabilities', () => {
    it('supports permission interception', () => {
      const caps = adapter.getCapabilities();
      expect(caps.permissionInterception).toBe(true);
      expect(caps.remoteApprovalResolution).toBe(true);
      expect(caps.messageInjection).toBe(false);
    });
  });

  it('has correct provider metadata', () => {
    expect(adapter.providerId).toBe('claude-code');
    expect(adapter.providerName).toBe('Claude Code');
  });
});

describe('CodexAdapter', () => {
  const adapter = new CodexAdapter();

  it('has correct provider metadata', () => {
    expect(adapter.providerId).toBe('codex');
    expect(adapter.providerName).toBe('OpenAI Codex');
  });

  it('generates hooks config', () => {
    const config = adapter.getHooksConfig(8765);
    expect(config).toHaveProperty('PreToolUse');
    expect(config).toHaveProperty('PostToolUse');
    expect(config).toHaveProperty('SessionStart');
  });
});

describe('GeminiAdapter', () => {
  const adapter = new GeminiAdapter();

  it('has correct provider metadata', () => {
    expect(adapter.providerId).toBe('gemini');
    expect(adapter.providerName).toBe('Gemini CLI');
  });

  it('generates hooks config', () => {
    const config = adapter.getHooksConfig(8765);
    expect(config).toHaveProperty('PreToolUse');
    expect(config).toHaveProperty('PostToolUse');
  });
});

describe('AdapterRegistry', () => {
  it('registers and retrieves adapters', () => {
    const registry = new AdapterRegistry();
    registry.register(new ClaudeCodeAdapter());
    registry.register(new CodexAdapter());

    expect(registry.has('claude-code')).toBe(true);
    expect(registry.has('codex')).toBe(true);
    expect(registry.has('unknown')).toBe(false);
    expect(registry.list()).toHaveLength(2);
  });

  it('gets adapter by provider ID', () => {
    const registry = new AdapterRegistry();
    registry.register(new ClaudeCodeAdapter());
    const adapter = registry.get('claude-code');
    expect(adapter?.providerId).toBe('claude-code');
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

  it('claude-code install creates settings with hooks', () => {
    const adapter = new ClaudeCodeAdapter();
    const result = adapter.install(8765);
    expect(result.success).toBe(true);

    const settingsPath = path.join(tmpDir, '.claude', 'settings.json');
    expect(fs.existsSync(settingsPath)).toBe(true);
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    expect(settings.hooks).toBeDefined();
    expect(settings.hooks.PreToolUse).toBeDefined();
  });

  it('claude-code uninstall removes hooks', () => {
    const adapter = new ClaudeCodeAdapter();
    adapter.install(8765);
    const result = adapter.uninstall();
    expect(result.success).toBe(true);
  });

  it('codex install creates hooks.json', () => {
    const adapter = new CodexAdapter();
    const result = adapter.install(8765);
    expect(result.success).toBe(true);

    const hooksPath = path.join(tmpDir, '.codex', 'hooks.json');
    expect(fs.existsSync(hooksPath)).toBe(true);
  });

  it('gemini install creates extension', () => {
    const adapter = new GeminiAdapter();
    const result = adapter.install(8765);
    expect(result.success).toBe(true);

    const extDir = path.join(tmpDir, '.gemini', 'extensions', 'deorch');
    expect(fs.existsSync(path.join(extDir, 'extension.json'))).toBe(true);
    expect(fs.existsSync(path.join(extDir, 'hooks', 'hooks.json'))).toBe(true);
  });
});
