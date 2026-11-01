export type ApprovalDecision = 'approve' | 'deny';

interface PendingEntry {
  resolve: (decision: ApprovalDecision) => void;
  reject: (err: Error) => void;
  expiresAt: Date;
  timer: ReturnType<typeof setTimeout>;
}

export class PendingApprovals {
  private pending = new Map<string, PendingEntry>();

  waitForDecision(requestId: string, timeoutMs: number): Promise<ApprovalDecision> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error('Approval request timed out'));
      }, timeoutMs);

      this.pending.set(requestId, {
        resolve,
        reject,
        expiresAt: new Date(Date.now() + timeoutMs),
        timer,
      });
    });
  }

  resolveDecision(requestId: string, decision: ApprovalDecision): boolean {
    const entry = this.pending.get(requestId);
    if (!entry) return false;
    clearTimeout(entry.timer);
    this.pending.delete(requestId);
    entry.resolve(decision);
    return true;
  }

  hasPending(requestId: string): boolean {
    return this.pending.has(requestId);
  }

  cleanup(): void {
    const now = new Date();
    for (const [id, entry] of this.pending) {
      if (entry.expiresAt < now) {
        clearTimeout(entry.timer);
        entry.reject(new Error('Expired'));
        this.pending.delete(id);
      }
    }
  }

  rejectAll(reason: string): void {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error(reason));
    }
    this.pending.clear();
  }

  size(): number {
    return this.pending.size;
  }
}
