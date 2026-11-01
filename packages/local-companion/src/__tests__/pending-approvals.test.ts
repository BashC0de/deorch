import { describe, it, expect } from 'vitest';
import { PendingApprovals } from '../approval/pending.js';

describe('PendingApprovals', () => {
  it('resolves a pending approval with a decision', async () => {
    const approvals = new PendingApprovals();
    const promise = approvals.waitForDecision('req-1', 5000);

    // Simulate decision arriving
    const resolved = approvals.resolveDecision('req-1', 'approve');
    expect(resolved).toBe(true);

    const decision = await promise;
    expect(decision).toBe('approve');
  });

  it('returns false when resolving unknown request', () => {
    const approvals = new PendingApprovals();
    expect(approvals.resolveDecision('nonexistent', 'deny')).toBe(false);
  });

  it('times out if no decision arrives', async () => {
    const approvals = new PendingApprovals();
    const promise = approvals.waitForDecision('req-1', 50);

    await expect(promise).rejects.toThrow('timed out');
    expect(approvals.hasPending('req-1')).toBe(false);
  });

  it('tracks pending count', async () => {
    const approvals = new PendingApprovals();
    const p1 = approvals.waitForDecision('req-1', 5000);
    const p2 = approvals.waitForDecision('req-2', 5000);

    expect(approvals.size()).toBe(2);

    approvals.resolveDecision('req-1', 'deny');
    expect(approvals.size()).toBe(1);

    approvals.resolveDecision('req-2', 'deny');
    expect(approvals.size()).toBe(0);

    // Await to prevent unhandled rejections
    await p1;
    await p2;
  });

  it('cleanup removes expired entries', async () => {
    const approvals = new PendingApprovals();

    // Create a pending approval with very short timeout
    // Catch immediately to prevent unhandled rejection
    let rejected = false;
    const promise = approvals.waitForDecision('req-1', 10).catch(() => {
      rejected = true;
    });

    // Wait for timeout to fire
    await promise;
    expect(rejected).toBe(true);
    expect(approvals.hasPending('req-1')).toBe(false);
  });
});
