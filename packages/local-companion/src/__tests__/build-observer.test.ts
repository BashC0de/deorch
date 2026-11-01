import { describe, it, expect } from 'vitest';
import { BuildObserver } from '../monitors/build-observer.js';

const observer = new BuildObserver({} as any);

describe('BuildObserver', () => {
  describe('detectBuildCommand', () => {
    it('detects npm run build', () => {
      expect(observer.detectBuildCommand('npm run build')).toBe('npm');
    });
    it('detects pnpm build', () => {
      expect(observer.detectBuildCommand('pnpm build')).toBe('pnpm');
    });
    it('detects pnpm run build', () => {
      expect(observer.detectBuildCommand('pnpm run build')).toBe('pnpm');
    });
    it('detects tsc', () => {
      expect(observer.detectBuildCommand('tsc --noEmit')).toBe('typescript');
    });
    it('detects cargo build', () => {
      expect(observer.detectBuildCommand('cargo build --release')).toBe('cargo');
    });
    it('detects go build', () => {
      expect(observer.detectBuildCommand('go build ./...')).toBe('go');
    });
    it('detects eslint', () => {
      expect(observer.detectBuildCommand('eslint src/ --ext .ts')).toBe('eslint');
    });
    it('detects ruff', () => {
      expect(observer.detectBuildCommand('ruff check src/')).toBe('ruff');
    });
    it('returns null for non-build commands', () => {
      expect(observer.detectBuildCommand('ls -la')).toBeNull();
      expect(observer.detectBuildCommand('cat file.txt')).toBeNull();
      expect(observer.detectBuildCommand('git status')).toBeNull();
    });
  });
});
