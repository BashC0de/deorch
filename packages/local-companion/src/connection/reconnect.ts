export class ReconnectStrategy {
  private attempts = 0;

  constructor(
    private readonly initialDelayMs: number,
    private readonly maxDelayMs: number,
    private readonly maxAttempts: number, // -1 = infinite
  ) {}

  reset(): void {
    this.attempts = 0;
  }

  shouldRetry(): boolean {
    if (this.maxAttempts === -1) return true;
    return this.attempts < this.maxAttempts;
  }

  nextDelay(): number {
    const base = this.initialDelayMs * Math.pow(2, this.attempts);
    const jitter = Math.random() * 0.3 * base;
    const delay = Math.min(base + jitter, this.maxDelayMs);
    this.attempts++;
    return Math.floor(delay);
  }

  get attemptCount(): number {
    return this.attempts;
  }
}
