import { Command } from 'commander';
import * as os from 'os';
import { loadCredentials, saveCredentials } from '../credentials.js';
import { apiRequest, getAuthHeaders } from './api.js';

interface DeviceResponse {
  id: string;
  name: string;
  status: string;
}

interface ChallengeResponse {
  challenge_token: string;
  expires_at: string;
}

interface PairingCompleteResponse {
  device_secret: string;
  message: string;
}

export const pairCommand = new Command('pair')
  .description('Pair this machine with your DeOrch account')
  .option('--name <name>', 'Device display name', os.hostname())
  .option('--token <token>', 'Pairing challenge token (for cross-machine pairing)')
  .option('--device-id <id>', 'Device ID (for cross-machine pairing)')
  .action(async (opts: { name: string; token?: string; deviceId?: string }) => {
    const creds = loadCredentials();
    if (!creds?.accessToken) {
      console.error('Not logged in. Run "deorch login" first.');
      process.exit(1);
    }

    const headers = getAuthHeaders();

    try {
      let deviceId: string;
      let challengeToken: string;

      if (opts.token && opts.deviceId) {
        // Cross-machine pairing: token and device ID provided externally
        deviceId = opts.deviceId;
        challengeToken = opts.token;
        console.log(`Completing pairing for device ${deviceId}...`);
      } else {
        // Self-pairing: register device, create challenge, complete in one flow
        console.log(`Registering device "${opts.name}"...`);

        const device = await apiRequest<DeviceResponse>('/api/v1/devices', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: opts.name,
            hostname: os.hostname(),
          }),
        });
        deviceId = device.id;
        console.log(`Device registered: ${deviceId} (status: ${device.status})`);

        // Generate pairing challenge
        console.log('Generating pairing challenge...');
        const challenge = await apiRequest<ChallengeResponse>(
          '/api/v1/pairing/challenge',
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ device_id: deviceId }),
          },
        );
        challengeToken = challenge.challenge_token;
      }

      // Complete pairing
      console.log('Completing pairing...');
      const result = await apiRequest<PairingCompleteResponse>(
        '/api/v1/pairing/complete',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            device_id: deviceId,
            challenge_token: challengeToken,
          }),
        },
      );

      // Store device credentials
      saveCredentials({
        ...creds,
        deviceId,
        deviceSecret: result.device_secret,
      });

      console.log('');
      console.log('Device paired successfully!');
      console.log(`  Device ID: ${deviceId}`);
      console.log(`  ${result.message}`);
      console.log('');
      console.log('Run "deorch start" to connect to the backend.');
    } catch (err) {
      console.error(
        `Pairing failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  });
