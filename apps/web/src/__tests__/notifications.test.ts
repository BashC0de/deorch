import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock window + localStorage before importing the module
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
};

// Ensure window is defined for the module's typeof check
vi.stubGlobal('window', { localStorage: localStorageMock });
vi.stubGlobal('localStorage', localStorageMock);

beforeEach(() => {
  localStorageMock.clear();
});

describe('notifications', () => {
  it('marks notification as read', async () => {
    const { isRead, markAsRead } = await import('../lib/notifications');
    expect(isRead('notif-1')).toBe(false);
    markAsRead('notif-1');
    expect(isRead('notif-1')).toBe(true);
  });

  it('marks all as read', async () => {
    const { isRead, markAllAsRead } = await import('../lib/notifications');
    localStorageMock.clear();
    markAllAsRead(['a', 'b', 'c']);
    expect(isRead('a')).toBe(true);
    expect(isRead('b')).toBe(true);
    expect(isRead('c')).toBe(true);
  });

  it('counts unread correctly', async () => {
    const { getUnreadCount, markAsRead } = await import('../lib/notifications');
    localStorageMock.clear();
    markAsRead('a');
    expect(getUnreadCount(['a', 'b', 'c'])).toBe(2);
  });

  it('returns 0 unread when all read', async () => {
    const { getUnreadCount, markAllAsRead } = await import('../lib/notifications');
    localStorageMock.clear();
    markAllAsRead(['x', 'y']);
    expect(getUnreadCount(['x', 'y'])).toBe(0);
  });

  it('returns all unread when none read', async () => {
    const { getUnreadCount } = await import('../lib/notifications');
    localStorageMock.clear();
    expect(getUnreadCount(['p', 'q', 'r'])).toBe(3);
  });
});
