import { loadConfig } from './config.js';
import { logger, setLogLevel } from './logger.js';
import { Companion } from './companion.js';

async function main(): Promise<void> {
  const config = loadConfig();
  setLogLevel(config.logLevel);

  logger.info('deorch_companion_starting', { version: '0.1.0' });

  const companion = new Companion(config);

  let stopping = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (stopping) return;
    stopping = true;
    logger.info('shutdown_signal', { signal });
    try {
      await companion.stop();
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await companion.start();
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
