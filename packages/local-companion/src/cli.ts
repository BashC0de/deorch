#!/usr/bin/env node
import { Command } from 'commander';
import { loginCommand } from './cli/login.js';
import { pairCommand } from './cli/pair.js';
import { startCommand } from './cli/start.js';
import { statusCommand } from './cli/status.js';
import { devicesCommand } from './cli/devices.js';
import { logoutCommand } from './cli/logout.js';
import { setupCommand } from './cli/setup.js';
import { uninstallCommand } from './cli/uninstall.js';
import { servicesCommand } from './cli/services.js';

const program = new Command();

program
  .name('deorch')
  .description('DeOrch Local Companion CLI')
  .version('0.1.0');

program.addCommand(loginCommand);
program.addCommand(pairCommand);
program.addCommand(setupCommand);
program.addCommand(startCommand);
program.addCommand(statusCommand);
program.addCommand(devicesCommand);
program.addCommand(servicesCommand);
program.addCommand(uninstallCommand);
program.addCommand(logoutCommand);

program.parse();
