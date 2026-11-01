import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface Credentials {
  apiUrl: string;
  accessToken?: string;
  refreshToken?: string;
  deviceId?: string;
  deviceSecret?: string;
}

function getCredentialsDir(): string {
  return path.join(os.homedir(), '.deorch');
}

function getCredentialsPath(): string {
  return path.join(getCredentialsDir(), 'credentials.json');
}

export function loadCredentials(): Credentials | null {
  const filePath = getCredentialsPath();
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as Credentials;
  } catch {
    return null;
  }
}

export function saveCredentials(creds: Credentials): void {
  const dir = getCredentialsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = getCredentialsPath();
  fs.writeFileSync(filePath, JSON.stringify(creds, null, 2), { mode: 0o600 });
  // On POSIX, ensure restrictive permissions even if file existed
  if (process.platform !== 'win32') {
    fs.chmodSync(filePath, 0o600);
  }
}

export function clearCredentials(): void {
  const filePath = getCredentialsPath();
  try {
    fs.unlinkSync(filePath);
  } catch {
    // File may not exist
  }
}
