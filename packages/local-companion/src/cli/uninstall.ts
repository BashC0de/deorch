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

export const uninstallCommand = new Command('uninstall')
  .description('Remove DeOrch hooks from agent providers')
  .option('--provider <id>', 'Specific provider to uninstall (default: all)')
  .action((opts: { provider?: string }) => {
    const registry = getRegistry();

    if (opts.provider) {
      const adapter = registry.get(opts.provider);
      if (!adapter) {
        console.error(`Unknown provider: ${opts.provider}`);
        process.exit(1);
      }
      const result = adapter.uninstall();
      if (result.success) {
        console.log(`DeOrch hooks removed from ${adapter.providerName}.`);
      } else {
        console.error(`Failed: ${result.error}`);
        process.exit(1);
      }
    } else {
      // Uninstall from all providers
      for (const adapter of registry.list()) {
        const result = adapter.uninstall();
        if (result.success) {
          console.log(`Removed hooks from ${adapter.providerName}`);
        }
      }
      console.log('All DeOrch hooks removed.');
    }
  });
