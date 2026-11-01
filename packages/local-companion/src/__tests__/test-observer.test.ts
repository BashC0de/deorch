import { describe, it, expect } from 'vitest';
import { TestObserver } from '../monitors/test-observer.js';

const observer = new TestObserver({} as any);

describe('TestObserver', () => {
  describe('detectTestCommand', () => {
    it('detects vitest', () => {
      expect(observer.detectTestCommand('npx vitest run')).toBe('vitest');
    });
    it('detects jest', () => {
      expect(observer.detectTestCommand('npx jest --coverage')).toBe('jest');
    });
    it('detects pytest', () => {
      expect(observer.detectTestCommand('python -m pytest tests/ -v')).toBe('pytest');
    });
    it('detects playwright', () => {
      expect(observer.detectTestCommand('npx playwright test')).toBe('playwright');
    });
    it('detects cargo test', () => {
      expect(observer.detectTestCommand('cargo test --release')).toBe('cargo-test');
    });
    it('returns null for non-test commands', () => {
      expect(observer.detectTestCommand('npm install')).toBeNull();
      expect(observer.detectTestCommand('git status')).toBeNull();
    });
  });

  describe('parseTestOutput', () => {
    it('parses vitest output', () => {
      const output = `
 Test Files  4 passed (4)
      Tests  29 passed (29)
   Start at  19:17:03
   Duration  1.29s
      `;
      const result = observer.parseTestOutput('vitest', output);
      expect(result).not.toBeNull();
      expect(result!.passed).toBe(29);
      expect(result!.failed).toBe(0);
      expect(result!.total).toBe(29);
      expect(result!.status).toBe('PASSED');
    });

    it('parses vitest output with failures', () => {
      const output = `
 Test Files  1 failed | 3 passed (4)
      Tests  2 failed | 27 passed (29)
   Duration  1.29s
      `;
      const result = observer.parseTestOutput('vitest', output);
      expect(result).not.toBeNull();
      expect(result!.passed).toBe(27);
      expect(result!.failed).toBe(2);
      expect(result!.status).toBe('FAILED');
    });

    it('parses pytest output', () => {
      const output = `
===== 24 passed, 2 failed, 1 skipped in 3.45s =====
      `;
      const result = observer.parseTestOutput('pytest', output);
      expect(result).not.toBeNull();
      expect(result!.passed).toBe(24);
      expect(result!.failed).toBe(2);
      expect(result!.skipped).toBe(1);
      expect(result!.total).toBe(27);
    });

    it('returns null for unparseable output', () => {
      const result = observer.parseTestOutput('vitest', 'random text with no test info');
      expect(result).toBeNull();
    });
  });
});
