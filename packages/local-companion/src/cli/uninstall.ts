import { Command } from 'commander';
import { uninstall } from '../adapter/claude-code.js';

export const uninstallCommand = new Command('uninstall')
  .description('Remove DeOrch hooks from Claude Code')
  .action(() => {
    console.log('Removing DeOrch hooks from Claude Code settings...');
    const result = uninstall();
    if (result.success) {
      console.log('DeOrch hooks removed successfully.');
      console.log('Claude Code will no longer route permission requests through DeOrch.');
    } else {
      console.error(`Failed to remove hooks: ${result.error}`);
      process.exit(1);
    }
  });
