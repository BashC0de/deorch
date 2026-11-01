import { api } from './client';
import type { TokenResponse, User } from '@/lib/types/api';

export async function registerUser(
  email: string,
  password: string,
  displayName: string,
): Promise<TokenResponse> {
  return api<TokenResponse>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, display_name: displayName }),
  });
}

export async function loginUser(
  email: string,
  password: string,
): Promise<TokenResponse> {
  return api<TokenResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}
