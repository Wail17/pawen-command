'use client';

import Link from 'next/link';
import { ReviewResult, CongruenceResult } from '@/lib/types';

export function ReviewPanel({ review }: { review: ReviewResult | null }) {
  if (!review) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-text-secondary mb-2">Quality Review</h3>
        <p className="text-text-muted text-xs">Not yet reviewed</p>
      </div>
    );
  }

  return (
    <div className={`bg-bg-card border rounded-xl p-4 ${review.passed ? 'border-success/30' : 'border-warning/30'}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-secondary">Quality Review</h3>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${review.passed ? 'text-success' : 'text-warning'}`}>
            {review.percentage}%
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-md ${review.passed ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
            {review.passed ? 'PASSED' : 'NEEDS WORK'}
          </span>
        </div>
      </div>

      {/* Dimension bars */}
      <div className="space-y-2">
        {review.dimensions.map((dim) => {
          const pct = Math.round((dim.score / dim.maxScore) * 100);
          return (
            <div key={dim.criterionId}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-text-secondary">{dim.name}</span>
                <span className="text-text-muted">{dim.score}/{dim.maxScore}</span>
              </div>
              <div className="h-1.5 bg-bg-primary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${pct >= 80 ? 'bg-success' : pct >= 60 ? 'bg-warning' : 'bg-error'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Feedback */}
      {review.feedback && (
        <div className="mt-3 p-3 bg-bg-primary rounded-lg">
          <p className="text-xs text-text-secondary">{review.feedback}</p>
        </div>
      )}

      <p className="text-text-muted text-xs mt-2">Iteration {review.iteration}</p>
    </div>
  );
}

export function CongruencePanel({
  congruence,
  hasCongruenceCheck,
  brandDNAStatus,
  projectId,
}: {
  congruence: CongruenceResult | null;
  hasCongruenceCheck?: boolean;
  brandDNAStatus?: 'missing' | 'unlocked' | 'locked';
  projectId?: string;
}) {
  if (!congruence) {
    // Gate doesn't have a congruence check at all (gates 1-3)
    if (hasCongruenceCheck === false) {
      return (
        <div className="bg-bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-text-secondary mb-2">Congruence Check</h3>
          <p className="text-text-muted text-xs">
            Not applicable — congruence is checked from Gate 4 onward, once Brand DNA is locked.
          </p>
        </div>
      );
    }

    // Gate supports congruence but Brand DNA isn't locked yet
    if (brandDNAStatus === 'missing') {
      return (
        <div className="bg-bg-card border border-warning/40 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-warning mb-2">Congruence Check — Brand DNA required</h3>
          <p className="text-text-muted text-xs mb-3">
            Compile your Brand DNA first. It&apos;s the single source of truth every downstream gate is measured against.
          </p>
          {projectId && (
            <Link
              href={`/project/${projectId}/brand-dna`}
              className="inline-block px-3 py-1.5 bg-accent-orange text-white text-xs font-semibold rounded-lg hover:bg-accent-orange-hover"
            >
              Compile Brand DNA →
            </Link>
          )}
        </div>
      );
    }
    if (brandDNAStatus === 'unlocked') {
      return (
        <div className="bg-bg-card border border-warning/40 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-warning mb-2">Congruence Check — Lock Brand DNA</h3>
          <p className="text-text-muted text-xs mb-3">
            Brand DNA is compiled but not locked. Lock it to enable the congruence check on this gate.
          </p>
          {projectId && (
            <Link
              href={`/project/${projectId}/brand-dna`}
              className="inline-block px-3 py-1.5 bg-accent-orange text-white text-xs font-semibold rounded-lg hover:bg-accent-orange-hover"
            >
              🔒 Lock Brand DNA →
            </Link>
          )}
        </div>
      );
    }

    // Fallback (should be rare — DNA locked but no congruence result yet, e.g. pre-regen)
    return (
      <div className="bg-bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-text-secondary mb-2">Congruence Check</h3>
        <p className="text-text-muted text-xs">Not yet computed for this output. Re-generate to run the check.</p>
      </div>
    );
  }

  const verdictColors: Record<string, string> = {
    CONGRUENT: 'text-success',
    NEEDS_ALIGNMENT: 'text-warning',
    REBUILD: 'text-error',
  };

  const dimensions = [
    { label: 'Locked Terms', value: congruence.dimensions.locked_terms_match, max: 20 },
    { label: 'Customer Language', value: congruence.dimensions.customer_language, max: 20 },
    { label: 'Emotional Arc', value: congruence.dimensions.emotional_arc, max: 15 },
    { label: 'Cross-Gate', value: congruence.dimensions.cross_gate_consistency, max: 20 },
    { label: 'Visual/Metaphor', value: congruence.dimensions.visual_metaphor, max: 10 },
    { label: 'Forbidden Content', value: congruence.dimensions.forbidden_content, max: 15 },
  ];

  return (
    <div className={`bg-bg-card border rounded-xl p-4 ${congruence.passed ? 'border-accent-teal/30' : 'border-warning/30'}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-secondary">Congruence</h3>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${verdictColors[congruence.verdict]}`}>
            {congruence.score}/100
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-md ${
            congruence.verdict === 'CONGRUENT' ? 'bg-success/20 text-success' :
            congruence.verdict === 'NEEDS_ALIGNMENT' ? 'bg-warning/20 text-warning' :
            'bg-error/20 text-error'
          }`}>
            {congruence.verdict}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {dimensions.map((dim) => {
          const pct = Math.round((dim.value / dim.max) * 100);
          return (
            <div key={dim.label}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-text-secondary">{dim.label}</span>
                <span className="text-text-muted">{dim.value}/{dim.max}</span>
              </div>
              <div className="h-1.5 bg-bg-primary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${pct >= 85 ? 'bg-accent-teal' : pct >= 60 ? 'bg-warning' : 'bg-error'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Drift Report */}
      {congruence.driftReport.length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="text-xs font-semibold text-text-secondary">Drift Report</p>
          {congruence.driftReport.map((item, i) => (
            <div key={i} className="p-2 bg-bg-primary rounded-lg text-xs">
              <span className={`font-mono ${
                item.severity === 'CRITICAL' ? 'text-error' :
                item.severity === 'WARNING' ? 'text-warning' : 'text-text-muted'
              }`}>
                [{item.severity}]
              </span>
              <span className="text-text-secondary ml-1">{item.location}:</span>
              <span className="text-text-muted ml-1">expected &quot;{item.expected}&quot;, found &quot;{item.found}&quot;</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
