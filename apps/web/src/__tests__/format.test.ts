import { describe, it, expect } from 'vitest';
import { timeAgo, timeUntil, riskColor, statusColor } from '../lib/utils/format';

describe('timeAgo', () => {
  it('shows seconds for recent timestamps', () => {
    const now = new Date(Date.now() - 30_000).toISOString();
    expect(timeAgo(now)).toBe('30s ago');
  });

  it('shows minutes', () => {
    const ago = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(timeAgo(ago)).toBe('5m ago');
  });

  it('shows hours', () => {
    const ago = new Date(Date.now() - 3 * 3600_000).toISOString();
    expect(timeAgo(ago)).toBe('3h ago');
  });

  it('shows days', () => {
    const ago = new Date(Date.now() - 2 * 86400_000).toISOString();
    expect(timeAgo(ago)).toBe('2d ago');
  });
});

describe('timeUntil', () => {
  it('returns Expired for past dates', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(timeUntil(past)).toBe('Expired');
  });

  it('shows seconds for near-future dates', () => {
    const future = new Date(Date.now() + 30_000).toISOString();
    const result = timeUntil(future);
    expect(result).toMatch(/^\d+s$/);
  });
});

describe('riskColor', () => {
  it('returns correct color for each risk level', () => {
    expect(riskColor('LOW')).toBe('text-risk-low');
    expect(riskColor('HIGH')).toBe('text-risk-high');
    expect(riskColor('CRITICAL')).toBe('text-risk-critical');
  });

  it('returns muted for null', () => {
    expect(riskColor(null)).toBe('text-text-muted');
  });
});

describe('statusColor', () => {
  it('returns correct colors for statuses', () => {
    expect(statusColor('PENDING')).toBe('text-status-warning');
    expect(statusColor('APPROVE')).toBe('text-status-success');
    expect(statusColor('APPROVED')).toBe('text-status-success');
    expect(statusColor('DENY')).toBe('text-status-error');
    expect(statusColor('DENIED')).toBe('text-status-error');
    expect(statusColor('ACTIVE')).toBe('text-status-success');
    expect(statusColor('CANCELLED')).toBe('text-text-muted');
    expect(statusColor('FAILED')).toBe('text-status-error');
  });

  it('returns muted for unknown status', () => {
    expect(statusColor('UNKNOWN')).toBe('text-text-muted');
  });
});
