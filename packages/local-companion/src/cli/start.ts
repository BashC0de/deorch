import { Command } from 'commander';
import { loadCredentials } from '../credentials.js';
import { loadConfig } from '../config.js';
import { setLogLevel } from '../logger.js';
import { Companion } from '../companion.js';

export const startCommand = new Command('start')
  .description('Start the DeOrch local companion')
  .action(async () => {
    // Merge credentials into env before loading config
    const creds = loadCredentials();
    if (creds) {
      if (creds.apiUrl && !process.env['COMPANION_API_URL']) {
        process.env['COMPANION_API_URL'] = creds.apiUrl;
      }
      if (creds.apiUrl && !process.env['COMPANION_WS_URL']) {
        const wsUrl = creds.apiUrl.replace(/^http/, 'ws') + '/ws/companion';
        process.env['COMPANION_WS_URL'] = wsUrl;
      }
      if (creds.deviceId && !process.env['COMPANION_DEVICE_ID']) {
        process.env['COMPANION_DEVICE_ID'] = creds.deviceId;
      }
      if (creds.deviceSecret && !process.env['COMPANION_DEVICE_SECRET']) {
        process.env['COMPANION_DEVICE_SECRET'] = creds.deviceSecret;
      }
    }

    const config = loadConfig();

    if (!config.deviceId || !config.deviceSecret) {
      console.error('Device not paired. Run "deorch pair" first.');
      process.exit(1);
    }

    setLogLevel(config.logLevel);

    console.log('Starting DeOrch companion...');
    console.log(`  API: ${config.apiUrl}`);
    console.log(`  Device: ${config.deviceId}`);
    console.log(`  Hooks: http://127.0.0.1:${config.hooksPort}`);
    console.log('');

    const companion = new Companion(config);

    let stopping = false;
    const shutdown = async (signal: string): Promise<void> => {
      if (stopping) return;
      stopping = true;
      console.log(`\nReceived ${signal}, shutting down...`);
      try {
        await companion.stop();
      } finally {
        process.exit(0);
      }
    };

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));

    await companion.start();
  });
