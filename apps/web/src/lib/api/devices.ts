import { api } from './client';
import type { Device } from '@/lib/types/api';

export async function fetchDevices(): Promise<Device[]> {
  return api<Device[]>('/api/v1/devices');
}

export async function fetchDevice(id: string): Promise<Device> {
  return api<Device>(`/api/v1/devices/${id}`);
}

export async function registerDevice(name: string, hostname?: string): Promise<Device> {
  return api<Device>('/api/v1/devices', {
    method: 'POST',
    body: JSON.stringify({ name, hostname: hostname ?? null }),
  });
}

export async function revokeDevice(id: string): Promise<void> {
  await api(`/api/v1/devices/${id}`, { method: 'DELETE' });
}

export interface PairingChallenge {
  challenge_token: string;
  expires_at: string;
}

export async function createPairingChallenge(deviceId: string): Promise<PairingChallenge> {
  return api<PairingChallenge>('/api/v1/pairing/challenge', {
    method: 'POST',
    body: JSON.stringify({ device_id: deviceId }),
  });
}

export interface PairingComplete {
  device_secret: string;
  message: string;
}

export async function completePairing(
  deviceId: string,
  challengeToken: string,
): Promise<PairingComplete> {
  return api<PairingComplete>('/api/v1/pairing/complete', {
    method: 'POST',
    body: JSON.stringify({ device_id: deviceId, challenge_token: challengeToken }),
  });
}
