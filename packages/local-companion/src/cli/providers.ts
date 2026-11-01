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

export const providersCommand = new Command('providers')
  .description('Manage agent provider integrations');

providersCommand
  .command('list')
  .description('List all supported providers and their installation status')
  .action(() => {
    const registry = getRegistry();
    const adapters = registry.list();

    console.log('Agent Providers');
    console.log('─'.repeat(70));

    for (const adapter of adapters) {
      const detection = adapter.detect();
      const caps = adapter.getCapabilities();
      const installed = detection.installed ? 'Installed' : 'Not found';
      const version = detection.version ? ` (${detection.version})` : '';

      console.log(`\n  ${adapter.providerName} [${adapter.providerId}]`);
      console.log(`    Status:  ${installed}${version}`);
      console.log(`    Config:  ${adapter.getSettingsPath()}`);
      console.log(`    Adapter: v${adapter.adapterVersion}`);

      // Capabilities summary
      const supported = Object.entries(caps).filter(([, v]) => v).map(([k]) => k);
      const unsupported = Object.entries(caps).filter(([, v]) => !v).map(([k]) => k);
      if (supported.length > 0) {
        console.log(`    [+] ${supported.join(', ')}`);
      }
      if (unsupported.length > 0) {
        console.log(`    [-] ${unsupported.join(', ')}`);
      }
    }
  });

providersCommand
  .command('status')
  .description('Check health of installed providers')
  .action(async () => {
    const registry = getRegistry();
    const port = parseInt(process.env['COMPANION_HOOKS_PORT'] ?? '8765', 10);

    console.log('Provider Health');
    console.log('─'.repeat(50));

    for (const adapter of registry.list()) {
      const detection = adapter.detect();
      if (!detection.installed) {
        console.log(`  ${adapter.providerName}: Not installed`);
        continue;
      }

      const healthy = await adapter.healthCheck(port);
      const status = healthy ? 'Hooks server reachable' : 'Hooks server not running';
      console.log(`  ${adapter.providerName}: ${status}`);
    }
  });
