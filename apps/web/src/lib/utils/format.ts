export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function timeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${minutes}m`;
}

export function riskColor(level: string | null): string {
  switch (level) {
    case 'LOW': return 'text-risk-low';
    case 'MEDIUM': return 'text-risk-medium';
    case 'HIGH': return 'text-risk-high';
    case 'CRITICAL': return 'text-risk-critical';
    default: return 'text-text-muted';
  }
}

export function riskBgColor(level: string | null): string {
  switch (level) {
    case 'LOW': return 'bg-risk-low/10 border-risk-low/20';
    case 'MEDIUM': return 'bg-risk-medium/10 border-risk-medium/20';
    case 'HIGH': return 'bg-risk-high/10 border-risk-high/20';
    case 'CRITICAL': return 'bg-risk-critical/10 border-risk-critical/20';
    default: return 'bg-surface-subtle border-border-subtle';
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case 'PENDING': return 'text-status-warning';
    case 'APPROVE': case 'APPROVED': return 'text-status-success';
    case 'DENY': case 'DENIED': return 'text-status-error';
    case 'EXPIRED': case 'CANCELLED': return 'text-text-muted';
    case 'FAILED': return 'text-status-error';
    case 'ACTIVE': return 'text-status-success';
    case 'COMPLETED': return 'text-text-secondary';
    case 'ERROR': return 'text-status-error';
    default: return 'text-text-muted';
  }
}
