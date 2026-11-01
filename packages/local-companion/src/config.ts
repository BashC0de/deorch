import { z } from 'zod';
import * as dotenv from 'dotenv';
import { loadCredentials } from './credentials.js';

dotenv.config();

const ConfigSchema = z.object({
  apiUrl: z.string().url().default('http://localhost:8000'),
  wsUrl: z.string().default('ws://localhost:8000/ws/companion'),
  deviceId: z.string().default(''),
  deviceSecret: z.string().default(''),
  sqlitePath: z.string().default('./data/companion.db'),
  hooksPort: z.coerce.number().int().default(8765),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  reconnectInitialDelayMs: z.coerce.number().int().default(1000),
  reconnectMaxDelayMs: z.coerce.number().int().default(30000),
  reconnectMaxAttempts: z.coerce.number().int().default(-1),
  wsHeartbeatIntervalMs: z.coerce.number().int().default(30000),
  wsPongTimeoutMs: z.coerce.number().int().default(45000),
});

export type CompanionConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(): CompanionConfig {
  // Load stored credentials as fallback for env vars
  const creds = loadCredentials();

  const raw = {
    apiUrl: process.env['COMPANION_API_URL'] ?? creds?.apiUrl,
    wsUrl: process.env['COMPANION_WS_URL'] ??
      (creds?.apiUrl ? creds.apiUrl.replace(/^http/, 'ws') + '/ws/companion' : undefined),
    deviceId: process.env['COMPANION_DEVICE_ID'] ?? creds?.deviceId,
    deviceSecret: process.env['COMPANION_DEVICE_SECRET'] ?? creds?.deviceSecret,
    sqlitePath: process.env['COMPANION_SQLITE_PATH'],
    hooksPort: process.env['COMPANION_HOOKS_PORT'],
    logLevel: process.env['LOG_LEVEL']?.toLowerCase(),
    reconnectInitialDelayMs: process.env['RECONNECT_INITIAL_DELAY_MS'],
    reconnectMaxDelayMs: process.env['RECONNECT_MAX_DELAY_MS'],
    reconnectMaxAttempts: process.env['RECONNECT_MAX_ATTEMPTS'],
    wsHeartbeatIntervalMs: process.env['WS_HEARTBEAT_INTERVAL_MS'],
    wsPongTimeoutMs: process.env['WS_PONG_TIMEOUT_MS'],
  };

  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    console.error('Invalid configuration:', result.error.flatten());
    process.exit(1);
  }
  return result.data;
}
