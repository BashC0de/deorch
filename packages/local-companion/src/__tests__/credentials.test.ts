import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// We test the credential functions by pointing them at a temp directory.
// Since the module uses os.homedir(), we mock it.
import { loadCredentials, saveCredentials, clearCredentials, type Credentials } from '../credentials.js';

const REAL_HOME = os.homedir();
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deorch-test-'));
  // Override HOME so ~/.deorch resolves to our tmpDir
  process.env['HOME'] = tmpDir;
  process.env['USERPROFILE'] = tmpDir;
});

afterEach(() => {
  process.env['HOME'] = REAL_HOME;
  process.env['USERPROFILE'] = REAL_HOME;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('credentials', () => {
  it('returns null when no credentials file exists', () => {
    expect(loadCredentials()).toBeNull();
  });

  it('saves and loads credentials', () => {
    const creds: Credentials = {
      apiUrl: 'http://localhost:8000',
      accessToken: 'test-token',
      deviceId: 'device-123',
      deviceSecret: 'secret-456',
    };
    saveCredentials(creds);
    const loaded = loadCredentials();
    expect(loaded).toEqual(creds);
  });

  it('clears credentials', () => {
    saveCredentials({ apiUrl: 'http://localhost:8000', accessToken: 'test' });
    clearCredentials();
    expect(loadCredentials()).toBeNull();
  });

  it('clearCredentials does not throw if file does not exist', () => {
    expect(() => clearCredentials()).not.toThrow();
  });

  it('preserves existing fields when updating', () => {
    const initial: Credentials = {
      apiUrl: 'http://localhost:8000',
      accessToken: 'old-token',
    };
    saveCredentials(initial);

    const updated: Credentials = {
      ...initial,
      deviceId: 'new-device',
      deviceSecret: 'new-secret',
    };
    saveCredentials(updated);

    const loaded = loadCredentials();
    expect(loaded?.accessToken).toBe('old-token');
    expect(loaded?.deviceId).toBe('new-device');
  });
});
