import { Command } from 'commander';
import { detect, install, healthCheck, getCapabilities } from '../adapter/claude-code.js';

export const setupCommand = new Command('setup')
  .description('Detect Claude Code and install DeOrch hooks')
  .option('--hooks-port <port>', 'Companion hooks server port', '8765')
  .action(async (opts: { hooksPort: string }) => {
    const port = parseInt(opts.hooksPort, 10);
    console.log('DeOrch Setup');
    console.log('─'.repeat(50));

    // Step 1: Detect Claude Code
    console.log('\n1. Detecting Claude Code...');
    const detection = detect();
    if (detection.installed) {
      console.log(`   Found: ${detection.path}`);
      if (detection.version) console.log(`   Version: ${detection.version}`);
    } else {
      console.log('   Claude Code not found in PATH.');
      console.log('   Install it from https://claude.ai/download and try again.');
      process.exit(1);
    }

    // Step 2: Install hooks
    console.log('\n2. Installing DeOrch hooks...');
    const result = install(port);
    if (result.success) {
      console.log(`   Hooks written to: ${result.settingsPath}`);
    } else {
      console.error(`   Failed: ${result.error}`);
      process.exit(1);
    }

    // Step 3: Check hooks server
    console.log('\n3. Checking hooks server...');
    const healthy = await healthCheck(port);
    if (healthy) {
      console.log(`   Hooks server is running on port ${port}`);
    } else {
      console.log(`   Hooks server not running. Start it with: deorch start`);
    }

    // Step 4: Show capabilities
    console.log('\n4. Capabilities:');
    const caps = getCapabilities();
    for (const cap of caps.supported) {
      console.log(`   [+] ${cap}`);
    }
    for (const cap of caps.unsupported) {
      console.log(`   [-] ${cap} (not supported)`);
    }

    console.log('\nSetup complete! Next steps:');
    console.log('  1. Run "deorch start" to start the companion');
    console.log('  2. Open your project with Claude Code');
    console.log('  3. Destructive operations will require remote approval');
  });
