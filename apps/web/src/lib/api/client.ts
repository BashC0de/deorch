const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8000';

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(`API ${status}: ${detail}`);
  }
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (token) {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('deorch_token', token);
    }
  } else {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('deorch_token');
    }
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== 'undefined') {
    accessToken = sessionStorage.getItem('deorch_token');
  }
  return accessToken;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const resp = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!resp.ok) {
    // Handle 401: clear token and redirect to login
    if (resp.status === 401) {
      setAccessToken(null);
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
        window.location.href = '/auth/login';
      }
    }

    let detail = resp.statusText;
    try {
      const body = await resp.json() as { detail?: string };
      detail = body.detail ?? detail;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(resp.status, detail);
  }

  return resp.json() as Promise<T>;
}
