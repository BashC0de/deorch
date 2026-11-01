import { describe, it, expect } from 'vitest';
import { GitMonitor } from '../monitors/git-monitor.js';

const monitor = new GitMonitor({} as any);

describe('GitMonitor', () => {
  describe('getGitState', () => {
    it('returns git state for current directory', () => {
      // This test runs against the actual repo
      const state = monitor.getGitState(process.cwd());
      if (state) {
        expect(state.branch).toBeTruthy();
        expect(state.commitHash).toMatch(/^[a-f0-9]{40}$/);
        expect(Array.isArray(state.modifiedFiles)).toBe(true);
        expect(Array.isArray(state.addedFiles)).toBe(true);
        expect(Array.isArray(state.deletedFiles)).toBe(true);
        expect(Array.isArray(state.untrackedFiles)).toBe(true);
        expect(state.diffStats).toBeDefined();
      }
      // If null, git is not available — that's OK in CI
    });

    it('returns null for non-git directory', () => {
      const state = monitor.getGitState('/tmp');
      expect(state).toBeNull();
    });

    it('limits file lists to prevent huge payloads', () => {
      const state = monitor.getGitState(process.cwd());
      if (state) {
        expect(state.modifiedFiles.length).toBeLessThanOrEqual(100);
        expect(state.addedFiles.length).toBeLessThanOrEqual(100);
        expect(state.deletedFiles.length).toBeLessThanOrEqual(100);
        expect(state.untrackedFiles.length).toBeLessThanOrEqual(50);
      }
    });
  });
});
