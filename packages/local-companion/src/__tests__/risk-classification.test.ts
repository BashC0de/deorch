import { describe, it, expect } from 'vitest';
import { requiresApproval, classifyRisk } from '../hooks/types.js';

describe('requiresApproval', () => {
  it('flags rm -rf commands', () => {
    expect(requiresApproval('Bash', { command: 'rm -rf /tmp/foo' })).toBe(true);
  });

  it('flags git push --force', () => {
    expect(requiresApproval('Bash', { command: 'git push --force origin main' })).toBe(true);
  });

  it('flags git reset --hard', () => {
    expect(requiresApproval('Bash', { command: 'git reset --hard HEAD~1' })).toBe(true);
  });

  it('flags DROP TABLE', () => {
    expect(requiresApproval('Bash', { command: 'psql -c "DROP TABLE users"' })).toBe(true);
  });

  it('flags kill commands', () => {
    expect(requiresApproval('Bash', { command: 'kill -9 1234' })).toBe(true);
  });

  it('does not flag safe commands', () => {
    expect(requiresApproval('Bash', { command: 'ls -la' })).toBe(false);
    expect(requiresApproval('Bash', { command: 'cat file.txt' })).toBe(false);
    expect(requiresApproval('Bash', { command: 'git status' })).toBe(false);
    expect(requiresApproval('Bash', { command: 'npm install' })).toBe(false);
  });

  it('does not flag non-Bash tools', () => {
    expect(requiresApproval('Read', { file_path: '/etc/passwd' })).toBe(false);
    expect(requiresApproval('Write', { file_path: '/tmp/test', content: 'rm -rf /' })).toBe(false);
  });
});

describe('classifyRisk', () => {
  it('classifies rm -rf / as CRITICAL', () => {
    expect(classifyRisk('Bash', { command: 'rm -rf /' })).toBe('CRITICAL');
  });

  it('classifies dd as CRITICAL', () => {
    expect(classifyRisk('Bash', { command: 'dd if=/dev/zero of=/dev/sda' })).toBe('CRITICAL');
  });

  it('classifies rm -rf path as HIGH', () => {
    expect(classifyRisk('Bash', { command: 'rm -rf ./node_modules' })).toBe('HIGH');
  });

  it('classifies git push --force as HIGH', () => {
    expect(classifyRisk('Bash', { command: 'git push --force' })).toBe('HIGH');
  });

  it('returns LOW for non-Bash tools', () => {
    expect(classifyRisk('Read', { command: 'rm -rf /' })).toBe('LOW');
  });
});
