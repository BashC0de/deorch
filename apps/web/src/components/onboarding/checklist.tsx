'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Circle, Monitor, Terminal, Shield, Layers } from 'lucide-react';
import { fetchDevices } from '@/lib/api/devices';
import { fetchSessions } from '@/lib/api/sessions';
import { fetchApprovals } from '@/lib/api/approvals';
import { cn } from '@/lib/utils/cn';
import Link from 'next/link';

interface Step {
  id: string;
  label: string;
  description: string;
  href: string;
  Icon: typeof Monitor;
  check: () => boolean;
}

export function OnboardingChecklist() {
  const { data: devices = [] } = useQuery({ queryKey: ['devices'], queryFn: fetchDevices });
  const { data: sessions = [] } = useQuery({ queryKey: ['sessions'], queryFn: fetchSessions });
  const { data: approvals = [] } = useQuery({ queryKey: ['approvals'], queryFn: () => fetchApprovals() });

  const pairedDevices = devices.filter((d) => d.status !== 'PENDING');
  const activeDevices = devices.filter((d) => d.status === 'ACTIVE');
  const hasSession = sessions.length > 0;
  const hasApproval = approvals.length > 0;

  const steps: Step[] = [
    {
      id: 'pair-device',
      label: 'Pair a device',
      description: 'Install the companion and pair your machine',
      href: '/dashboard/devices',
      Icon: Monitor,
      check: () => pairedDevices.length > 0,
    },
    {
      id: 'connect-agent',
      label: 'Connect an agent',
      description: 'Run "deorch setup" to install hooks',
      href: '/dashboard/providers',
      Icon: Terminal,
      check: () => activeDevices.length > 0,
    },
    {
      id: 'first-session',
      label: 'Start a coding session',
      description: 'Use Claude Code, Codex, or Gemini CLI',
      href: '/dashboard/sessions',
      Icon: Terminal,
      check: () => hasSession,
    },
    {
      id: 'first-approval',
      label: 'Handle an approval',
      description: 'Approve or deny a permission request',
      href: '/dashboard/approvals',
      Icon: Shield,
      check: () => hasApproval,
    },
  ];

  const completedCount = steps.filter((s) => s.check()).length;
  const allDone = completedCount === steps.length;

  if (allDone) return null; // Hide when all steps complete

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-raised p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Get Started</h2>
        <span className="text-[10px] text-text-muted">{completedCount}/{steps.length} complete</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-surface-subtle overflow-hidden">
        <div
          className="h-full bg-accent transition-all duration-300"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>

      <div className="space-y-1.5">
        {steps.map((step) => {
          const done = step.check();
          return (
            <Link
              key={step.id}
              href={step.href}
              className={cn(
                'flex items-center gap-3 rounded-md p-2.5 transition-colors',
                done ? 'opacity-60' : 'hover:bg-surface-subtle',
              )}
            >
              {done ? (
                <CheckCircle size={16} className="text-status-success shrink-0" />
              ) : (
                <Circle size={16} className="text-text-muted shrink-0" />
              )}
              <div>
                <p className={cn('text-xs font-medium', done && 'line-through text-text-muted')}>{step.label}</p>
                <p className="text-[10px] text-text-muted">{step.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
