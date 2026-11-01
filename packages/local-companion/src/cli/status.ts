import { Command } from 'commander';
import { loadCredentials } from '../credentials.js';

export const statusCommand = new Command('status')
  .description('Show companion status and credentials')
  .action(async () => {
    const creds = loadCredentials();

    if (!creds) {
      console.log('Status: Not configured');
      console.log('Run "deorch login" to authenticate.');
      return;
    }

    console.log('DeOrch Companion Status');
    console.log('─'.repeat(40));
    console.log(`  API URL:    ${creds.apiUrl}`);
    console.log(`  Logged in:  ${creds.accessToken ? 'Yes' : 'No'}`);
    console.log(`  Device ID:  ${creds.deviceId ?? 'Not paired'}`);
    console.log(`  Paired:     ${creds.deviceId && creds.deviceSecret ? 'Yes' : 'No'}`);

    // Check if hooks server is running
    const hooksPort = process.env['COMPANION_HOOKS_PORT'] ?? '8765';
    try {
      const resp = await fetch(`http://127.0.0.1:${hooksPort}/hooks/health`, {
        signal: AbortSignal.timeout(2000),
      });
      console.log(`  Hooks:      Running (port ${hooksPort}, ${resp.ok ? 'healthy' : 'unhealthy'})`);
    } catch {
      console.log(`  Hooks:      Not running`);
    }
  });
