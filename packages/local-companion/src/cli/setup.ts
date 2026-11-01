import { Command } from 'commander';
import { AdapterRegistry } from '../adapter/types.js';
import { ClaudeCodeAdapter } from '../adapter/claude-code.js';
import { CodexAdapter } from '../adapter/codex.js';
import { GeminiAdapter } from '../adapter/gemini.js';

function getRegistry(): AdapterRegistry {
  const registry = new AdapterRegistry();
  registry.register(new ClaudeCodeAdapter());
  registry.register(new CodexAdapter());
  registry.register(new GeminiAdapter());
  return registry;
}

export const setupCommand = new Command('setup')
  .description('Detect and install DeOrch hooks for an agent provider')
  .option('--provider <id>', 'Provider to set up (claude-code, codex, gemini)')
  .option('--hooks-port <port>', 'Companion hooks server port', '8765')
  .action(async (opts: { provider?: string; hooksPort: string }) => {
    const port = parseInt(opts.hooksPort, 10);
    const registry = getRegistry();

    console.log('DeOrch Setup');
    console.log('─'.repeat(50));

    if (opts.provider) {
      // Set up specific provider
      const adapter = registry.get(opts.provider);
      if (!adapter) {
        console.error(`Unknown provider: ${opts.provider}`);
        console.log(`Available: ${registry.list().map((a) => a.providerId).join(', ')}`);
        process.exit(1);
      }
      await setupProvider(adapter, port);
    } else {
      // Auto-detect and set up all installed providers
      console.log('\nDetecting installed providers...');
      const installed = registry.getInstalled();
      if (installed.length === 0) {
        console.log('No supported agent CLIs found.');
        console.log(`Supported: ${registry.list().map((a) => `${a.providerName} (${a.providerId})`).join(', ')}`);
        process.exit(1);
      }
      for (const adapter of installed) {
        await setupProvider(adapter, port);
      }
    }

    console.log('\nSetup complete! Run "deorch start" to begin.');
  });

async function setupProvider(adapter: ReturnType<AdapterRegistry['get']> & object, port: number): Promise<void> {
  console.log(`\n${adapter.providerName}:`);

  // Detect
  const detection = adapter.detect();
  if (detection.installed) {
    console.log(`  Found: ${detection.path ?? 'yes'}${detection.version ? ` (${detection.version})` : ''}`);
  } else {
    console.log(`  Not found in PATH — skipping`);
    return;
  }

  // Install hooks
  const result = adapter.install(port);
  if (result.success) {
    console.log(`  Hooks installed: ${result.settingsPath}`);
  } else {
    console.error(`  Hook install failed: ${result.error}`);
    return;
  }

  // Health check
  const healthy = await adapter.healthCheck(port);
  console.log(`  Hooks server: ${healthy ? 'Running' : 'Not running (start with "deorch start")'}`);

  // Capabilities
  const caps = adapter.getCapabilities();
  const supported = Object.entries(caps).filter(([, v]) => v).map(([k]) => k);
  console.log(`  Capabilities: ${supported.length} supported`);
}
