const STORAGE_KEY = 'deorch_read_notifications';

function getReadSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadSet(set: Set<string>): void {
  if (typeof window === 'undefined') return;
  // Keep only last 500 IDs to prevent unbounded growth
  const arr = [...set].slice(-500);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

export function isRead(id: string): boolean {
  return getReadSet().has(id);
}

export function markAsRead(id: string): void {
  const set = getReadSet();
  set.add(id);
  saveReadSet(set);
}

export function markAllAsRead(ids: string[]): void {
  const set = getReadSet();
  for (const id of ids) set.add(id);
  saveReadSet(set);
}

export function getUnreadCount(allIds: string[]): number {
  const read = getReadSet();
  return allIds.filter((id) => !read.has(id)).length;
}
