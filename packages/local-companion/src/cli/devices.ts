import { Command } from 'commander';
import { apiRequest, getAuthHeaders } from './api.js';

interface Device {
  id: string;
  name: string;
  hostname: string | null;
  status: string;
  last_seen_at: string | null;
  paired_at: string | null;
  created_at: string;
}

export const devicesCommand = new Command('devices')
  .description('List your registered devices')
  .action(async () => {
    const headers = getAuthHeaders();

    try {
      const devices = await apiRequest<Device[]>('/api/v1/devices', { headers });

      if (devices.length === 0) {
        console.log('No devices registered. Run "deorch pair" to pair this machine.');
        return;
      }

      console.log('Your Devices');
      console.log('─'.repeat(80));
      console.log(
        padRight('NAME', 20) +
        padRight('STATUS', 12) +
        padRight('HOSTNAME', 20) +
        padRight('LAST SEEN', 20) +
        'ID',
      );
      console.log('─'.repeat(80));

      for (const d of devices) {
        const lastSeen = d.last_seen_at
          ? new Date(d.last_seen_at).toLocaleString()
          : 'Never';
        console.log(
          padRight(d.name, 20) +
          padRight(d.status, 12) +
          padRight(d.hostname ?? '-', 20) +
          padRight(lastSeen, 20) +
          d.id,
        );
      }
    } catch (err) {
      console.error(`Failed to list devices: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

function padRight(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len - 1) + ' ' : str + ' '.repeat(len - str.length);
}
