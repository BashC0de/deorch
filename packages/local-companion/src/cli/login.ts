import { Command } from 'commander';
import * as readline from 'readline';
import { loadCredentials, saveCredentials } from '../credentials.js';
import { getApiUrl } from './api.js';

function prompt(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    if (hidden && process.stdin.isTTY) {
      process.stdout.write(question);
      const stdin = process.stdin;
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf-8');

      let input = '';
      const onData = (ch: string) => {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false);
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(input);
        } else if (ch === '\u0003') {
          process.exit(0);
        } else if (ch === '\u007f' || ch === '\b') {
          input = input.slice(0, -1);
        } else {
          input += ch;
        }
      };
      stdin.on('data', onData);
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

export const loginCommand = new Command('login')
  .description('Authenticate with the DeOrch backend')
  .option('--api-url <url>', 'Backend API URL')
  .action(async (opts: { apiUrl?: string }) => {
    const apiUrl = opts.apiUrl ?? getApiUrl();

    console.log(`Logging in to ${apiUrl}`);
    const email = await prompt('Email: ');
    const password = await prompt('Password: ', true);

    try {
      const resp = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!resp.ok) {
        const body = await resp.text();
        console.error(`Login failed: ${body}`);
        process.exit(1);
      }

      const data = (await resp.json()) as {
        access_token: string;
        token_type: string;
        expires_in: number;
      };

      const existing = loadCredentials();
      saveCredentials({
        apiUrl,
        accessToken: data.access_token,
        deviceId: existing?.deviceId,
        deviceSecret: existing?.deviceSecret,
      });

      console.log('Login successful. Credentials stored in ~/.deorch/credentials.json');
    } catch (err) {
      console.error(`Login error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });
