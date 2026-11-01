import { loadCredentials } from '../credentials.js';

export function getApiUrl(): string {
  const creds = loadCredentials();
  return creds?.apiUrl ?? process.env['COMPANION_API_URL'] ?? 'http://localhost:8000';
}

export function getAuthHeaders(): Record<string, string> {
  const creds = loadCredentials();
  if (!creds?.accessToken) {
    console.error('Not logged in. Run "deorch login" first.');
    process.exit(1);
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${creds.accessToken}`,
  };
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${getApiUrl()}${path}`;
  const resp = await fetch(url, options);
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`API ${resp.status}: ${body}`);
  }
  return resp.json() as Promise<T>;
}
