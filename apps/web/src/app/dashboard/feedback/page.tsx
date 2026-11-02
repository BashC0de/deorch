'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import { timeAgo } from '@/lib/utils/format';

interface FeedbackItem {
  id: string;
  category: string;
  severity: string;
  description: string;
  status: string;
  priority: string;
  resolution_notes: string | null;
  created_at: string;
}

const CATEGORIES = ['general', 'bug', 'feature-request', 'onboarding', 'agent-integration', 'workflow'];

export default function FeedbackPage() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('general');
  const [severity, setSeverity] = useState('low');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { data: feedback = [] } = useQuery({
    queryKey: ['feedback'],
    queryFn: () => api<FeedbackItem[]>('/api/v1/feedback'),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      api('/api/v1/feedback', {
        method: 'POST',
        body: JSON.stringify({ category, severity, description }),
      }),
    onSuccess: () => {
      setDescription('');
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
      void queryClient.invalidateQueries({ queryKey: ['feedback'] });
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Feedback</h1>

      {/* Submit form */}
      <div className="rounded-lg border border-border-subtle bg-surface-raised p-4 space-y-3">
        <h2 className="text-sm font-semibold text-text-secondary">Share Your Feedback</h2>

        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                category === cat ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-muted',
              )}
            >
              {cat.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {['low', 'medium', 'high'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverity(sev)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                severity === sev ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-muted',
              )}
            >
              {sev.charAt(0).toUpperCase() + sev.slice(1)}
            </button>
          ))}
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your experience, report a bug, or suggest a feature..."
          rows={4}
          className="w-full rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
        />

        <button
          onClick={() => submitMutation.mutate()}
          disabled={!description.trim() || submitMutation.isPending}
          className="rounded-md bg-accent-primary px-4 py-2 text-sm font-medium text-white hover:bg-accent-primary/90 disabled:opacity-50 transition-colors min-h-[40px]"
        >
          {submitMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
        </button>

        {submitted && (
          <p className="flex items-center gap-1.5 text-xs text-status-success">
            <CheckCircle size={12} /> Feedback submitted. Thank you!
          </p>
        )}
      </div>

      {/* History */}
      <div>
        <h2 className="text-sm font-semibold text-text-secondary mb-2">Your Feedback ({feedback.length})</h2>
        {feedback.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-4">No feedback submitted yet</p>
        ) : (
          <div className="space-y-1.5">
            {feedback.map((f) => (
              <div key={f.id} className="rounded-md border border-border-subtle bg-surface-raised p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded bg-surface-subtle px-1.5 py-0.5 text-text-muted">{f.category}</span>
                      <span className="text-text-muted">{f.severity}</span>
                      <span className="text-text-muted">{timeAgo(f.created_at)}</span>
                    </div>
                    <p className="text-sm text-text-secondary mt-1">{f.description}</p>
                  </div>
                  <span className={cn(
                    'text-[10px] font-medium shrink-0',
                    f.status === 'resolved' ? 'text-status-success' : 'text-text-muted',
                  )}>
                    {f.status}
                  </span>
                </div>
                {f.resolution_notes && (
                  <p className="text-xs text-text-muted mt-2 pl-2 border-l-2 border-border-subtle">{f.resolution_notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
