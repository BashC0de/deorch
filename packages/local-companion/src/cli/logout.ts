import { Command } from 'commander';
import { clearCredentials, loadCredentials } from '../credentials.js';

export const logoutCommand = new Command('logout')
  .description('Clear stored credentials and log out')
  .action(() => {
    const creds = loadCredentials();
    if (!creds) {
      console.log('No credentials found. Already logged out.');
      return;
    }

    clearCredentials();
    console.log('Credentials cleared. Logged out successfully.');
    if (creds.deviceId) {
      console.log('Note: Your device is still registered on the server. Use the dashboard to revoke it if needed.');
    }
  });
