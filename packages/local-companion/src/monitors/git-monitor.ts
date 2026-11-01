import { execSync } from 'child_process';
import { logger } from '../logger.js';
import type { CompanionConfig } from '../config.js';

interface GitState {
  branch: string;
  commitHash: string;
  modifiedFiles: string[];
  addedFiles: string[];
  deletedFiles: string[];
  untrackedFiles: string[];
  diffStats: { additions: number; deletions: number };
}

export class GitMonitor {
  private timer: ReturnType<typeof setInterval> | null = null;
  private projectPaths: string[] = [];

  constructor(private config: CompanionConfig) {}

  /** Register project paths to monitor */
  setProjects(paths: string[]): void {
    this.projectPaths = paths;
  }

  start(intervalMs = 60_000): void {
    if (this.projectPaths.length === 0) {
      logger.debug('git_monitor_no_projects');
      return;
    }
    // Run immediately then on interval
    void this.snapshot();
    this.timer = setInterval(() => void this.snapshot(), intervalMs);
    logger.info('git_monitor_started', { projects: this.projectPaths.length, interval: intervalMs });
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async snapshot(): Promise<void> {
    for (const projectPath of this.projectPaths) {
      try {
        const state = this.getGitState(projectPath);
        if (!state) continue;

        await this.submitSnapshot(state);
      } catch (err) {
        logger.warn('git_snapshot_failed', { path: projectPath, error: String(err) });
      }
    }
  }

  getGitState(cwd: string): GitState | null {
    try {
      const branch = execSync('git branch --show-current', { cwd, encoding: 'utf-8', timeout: 5000 }).trim();
      const commitHash = execSync('git log -1 --format=%H', { cwd, encoding: 'utf-8', timeout: 5000 }).trim();
      const statusOutput = execSync('git status --porcelain', { cwd, encoding: 'utf-8', timeout: 5000 });

      const modifiedFiles: string[] = [];
      const addedFiles: string[] = [];
      const deletedFiles: string[] = [];
      const untrackedFiles: string[] = [];

      for (const line of statusOutput.split('\n').filter(Boolean)) {
        const code = line.slice(0, 2);
        const file = line.slice(3);
        if (code.includes('M')) modifiedFiles.push(file);
        else if (code.includes('A')) addedFiles.push(file);
        else if (code.includes('D')) deletedFiles.push(file);
        else if (code === '??') untrackedFiles.push(file);
      }

      // Diff stats (safe, read-only)
      let additions = 0;
      let deletions = 0;
      try {
        const diffStat = execSync('git diff --shortstat', { cwd, encoding: 'utf-8', timeout: 5000 });
        const addMatch = diffStat.match(/(\d+) insertion/);
        const delMatch = diffStat.match(/(\d+) deletion/);
        if (addMatch) additions = parseInt(addMatch[1]!, 10);
        if (delMatch) deletions = parseInt(delMatch[1]!, 10);
      } catch { /* no diff */ }

      return {
        branch,
        commitHash,
        modifiedFiles: modifiedFiles.slice(0, 100), // Limit to prevent huge payloads
        addedFiles: addedFiles.slice(0, 100),
        deletedFiles: deletedFiles.slice(0, 100),
        untrackedFiles: untrackedFiles.slice(0, 50),
        diffStats: { additions, deletions },
      };
    } catch {
      return null; // Not a git repo or git not available
    }
  }

  private async submitSnapshot(state: GitState): Promise<void> {
    try {
      await fetch(`${this.config.apiUrl}/api/v1/git-snapshots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.deviceId}:${this.config.deviceSecret}`,
        },
        body: JSON.stringify({
          branch: state.branch,
          commit_hash: state.commitHash,
          modified_files: state.modifiedFiles,
          added_files: state.addedFiles,
          deleted_files: state.deletedFiles,
          untracked_files: state.untrackedFiles,
          diff_stats: state.diffStats,
        }),
      });
    } catch {
      // Backend unreachable — skip
    }
  }
}
