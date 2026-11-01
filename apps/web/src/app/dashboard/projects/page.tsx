'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { FolderOpen, CheckCircle, XCircle, GitBranch, Server } from 'lucide-react';
import { fetchProjects } from '@/lib/api/projects';
import { fetchTestRuns, fetchBuildResults, fetchGitSnapshots, fetchServices } from '@/lib/api/intelligence';
import { cn } from '@/lib/utils/cn';
import { timeAgo } from '@/lib/utils/format';

export default function ProjectsPage() {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: fetchServices,
  });

  const { data: testRuns = [] } = useQuery({
    queryKey: ['test-runs'],
    queryFn: () => fetchTestRuns(undefined, 50),
  });

  const { data: builds = [] } = useQuery({
    queryKey: ['build-results'],
    queryFn: () => fetchBuildResults(undefined, 50),
  });

  const { data: gitSnapshots = [] } = useQuery({
    queryKey: ['git-snapshots'],
    queryFn: () => fetchGitSnapshots(undefined, 50),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Projects</h1>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-surface-raised animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">No projects registered yet</p>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => {
            const projServices = services.filter((s) => s.project_id === p.id);
            const latestTest = testRuns.find((t) => t.project_id === p.id);
            const latestBuild = builds.find((b) => b.project_id === p.id);
            const latestGit = gitSnapshots.find((g) => g.project_id === p.id);

            return (
              <Link
                key={p.id}
                href={`/dashboard/projects/${p.id}`}
                className="block rounded-lg border border-border-subtle bg-surface-raised p-4 hover:bg-surface-subtle transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <FolderOpen size={16} className="text-accent shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      {p.path && (
                        <p className="text-[10px] font-mono text-text-muted mt-0.5 truncate max-w-[250px]">{p.path}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status indicators */}
                <div className="flex items-center gap-3 mt-3 text-xs text-text-muted">
                  {/* Services */}
                  {projServices.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Server size={12} />
                      {projServices.filter((s) => s.status === 'HEALTHY').length}/{projServices.length}
                    </span>
                  )}

                  {/* Tests */}
                  {latestTest && (
                    <span className={cn('flex items-center gap-1', latestTest.failed > 0 ? 'text-status-error' : 'text-status-success')}>
                      {latestTest.failed > 0 ? <XCircle size={12} /> : <CheckCircle size={12} />}
                      {latestTest.passed}/{latestTest.total_tests}
                    </span>
                  )}

                  {/* Build */}
                  {latestBuild && (
                    <span className={cn(latestBuild.status === 'SUCCESS' ? 'text-status-success' : 'text-status-error')}>
                      Build: {latestBuild.status}
                    </span>
                  )}

                  {/* Git */}
                  {latestGit && (
                    <span className="flex items-center gap-1">
                      <GitBranch size={12} />
                      {latestGit.branch}
                      {(latestGit.modified_files.length + latestGit.added_files.length + latestGit.deleted_files.length) > 0 && (
                        <span className="text-status-warning">
                          +{latestGit.modified_files.length + latestGit.added_files.length + latestGit.deleted_files.length}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
