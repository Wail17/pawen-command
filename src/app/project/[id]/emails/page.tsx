'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Project } from '@/lib/types';
import { getProject } from '@/lib/store/db';
import {
  demoEmailSequences,
  type EmailSequencesMap,
  type EmailSequence,
  type EmailSequenceEmail,
} from '@/lib/gates/demoData';
import Pipeline from '@/components/ui/Pipeline';

// ---- Sequence type config ----

interface SequenceTypeConfig {
  key: string;
  label: string;
  icon: string;
  count: number;
}

const SEQUENCE_TYPES: SequenceTypeConfig[] = [
  { key: 'welcome',             label: 'Welcome Series',       icon: '\u{1F44B}', count: 5 },
  { key: 'abandon_cart',        label: 'Abandon Cart',         icon: '\u{1F6D2}', count: 4 },
  { key: 'post_purchase',       label: 'Post-Purchase',        icon: '\u{1F4E6}', count: 4 },
  { key: 'winback',             label: 'Winback',              icon: '\u{1F49C}', count: 3 },
  { key: 'browse_abandonment',  label: 'Browse Abandonment',   icon: '\u{1F440}', count: 3 },
  { key: 'vip_nurture',         label: 'VIP Nurture',          icon: '\u{1F451}', count: 4 },
  { key: 'launch',              label: 'Launch Sequence',      icon: '\u{1F680}', count: 5 },
];

export default function EmailsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('welcome');
  const [sequences, setSequences] = useState<EmailSequencesMap>({});
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await getProject(projectId);
      if (!p) { router.push('/'); return; }
      setProject(p);
      setLoading(false);
    })();
  }, [projectId, router]);

  // Load demo data
  const handleLoadDemo = useCallback(() => {
    const demo = demoEmailSequences();
    setSequences(demo);
    setError(null);
  }, []);

  // Generate via API
  const handleGenerate = useCallback(async (seqType: string) => {
    if (!project) return;
    setGenerating(seqType);
    setError(null);

    try {
      const brandDNA = project.brandDNA;
      const hooks = brandDNA?.sub_avatars
        ?.flatMap((sa) => {
          const saFull = project.avatarRunResult?.sub_avatars?.find((s) => s.id === sa.id);
          return saFull?.angles?.hooks ?? [];
        }) ?? [];

      const res = await fetch('/api/emails/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sequenceType: seqType,
          brandDNA: brandDNA ?? null,
          hooks: hooks.length > 0 ? hooks : null,
          voiceProfile: brandDNA?.voice_profile ?? null,
          funnelType: project.selectedFunnel ?? null,
          productName: brandDNA?.product_name ?? project.name,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Generation failed');
      }

      const data = await res.json();
      setSequences((prev) => ({ ...prev, [seqType]: data.sequence }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setGenerating(null);
    }
  }, [project]);

  // Copy all emails in a sequence
  const handleCopyAll = useCallback(async (seq: EmailSequence) => {
    const text = seq.emails.map((email) => {
      const subjects = email.subject_lines.map((s) => `  ${s.variant}: ${s.text}`).join('\n');
      // Strip HTML for clipboard
      const plainBody = email.body
        .replace(/<\/p>/g, '\n\n')
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<li>/g, '- ')
        .replace(/<\/li>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .trim();

      return `=== Email ${email.position} ===
SUBJECT LINES:
${subjects}

PREVIEW: ${email.preview_text}

SEND TIMING: ${email.send_timing}

BODY:
${plainBody}

CTA: ${email.cta_text}
`;
    }).join('\n\n');

    const header = `${seq.label} - ${seq.emails.length} emails\n${'='.repeat(50)}\n\n`;
    await navigator.clipboard.writeText(header + text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  if (loading || !project) {
    return (
      <div className="flex min-h-screen bg-bg-primary">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-text-muted animate-pulse">Loading...</div>
        </div>
      </div>
    );
  }

  const activeSeq = sequences[activeType] ?? null;

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <Pipeline project={project} />

      <main className="flex-1 flex">
        {/* Left column: Sequence type selector */}
        <div className="w-72 border-r border-border bg-bg-card p-4 flex flex-col gap-2">
          <h2 className="text-text-primary font-bold text-lg mb-1">Email Sequences</h2>
          <p className="text-text-muted text-xs mb-3">
            7 e-commerce email sequence types. Generate with AI or load demo data.
          </p>

          {/* Load Demo button */}
          <button
            onClick={handleLoadDemo}
            className="w-full mb-3 px-3 py-2 rounded-lg bg-bg-input border border-border text-text-secondary text-sm hover:bg-bg-card-hover hover:text-accent-teal transition-colors"
          >
            Load Demo Data (All 7)
          </button>

          {/* Sequence type tabs */}
          {SEQUENCE_TYPES.map((st) => {
            const isActive = activeType === st.key;
            const hasData = !!sequences[st.key];
            const isGenerating = generating === st.key;

            return (
              <button
                key={st.key}
                onClick={() => setActiveType(st.key)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm text-left transition-colors
                  ${isActive
                    ? 'border-accent-orange bg-bg-card-hover text-text-primary'
                    : 'border-transparent bg-bg-card text-text-secondary hover:bg-bg-card-hover'
                  }
                `}
              >
                <span className="text-lg">{st.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{st.label}</div>
                  <div className="text-text-muted text-xs">{st.count} emails</div>
                </div>
                {isGenerating && (
                  <span className="text-accent-orange animate-pulse text-xs">...</span>
                )}
                {hasData && !isGenerating && (
                  <span className="w-2 h-2 rounded-full bg-success flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Right column: Email cards */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-text-primary font-bold text-2xl">
                {SEQUENCE_TYPES.find((s) => s.key === activeType)?.icon}{' '}
                {SEQUENCE_TYPES.find((s) => s.key === activeType)?.label}
              </h1>
              <p className="text-text-muted text-sm mt-1">
                {SEQUENCE_TYPES.find((s) => s.key === activeType)?.count} emails in this sequence
              </p>
            </div>
            <div className="flex gap-2">
              {activeSeq && (
                <button
                  onClick={() => handleCopyAll(activeSeq)}
                  className="px-4 py-2 rounded-lg bg-bg-card border border-border text-text-secondary text-sm hover:bg-bg-card-hover transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy All'}
                </button>
              )}
              <button
                onClick={() => handleGenerate(activeType)}
                disabled={generating !== null}
                className="px-4 py-2 rounded-lg bg-accent-orange text-white text-sm font-medium hover:bg-accent-orange-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generating === activeType ? 'Generating...' : 'Generate with AI'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Empty state */}
          {!activeSeq && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-5xl mb-4">
                {SEQUENCE_TYPES.find((s) => s.key === activeType)?.icon}
              </div>
              <h3 className="text-text-primary font-semibold text-lg mb-2">
                No emails generated yet
              </h3>
              <p className="text-text-muted text-sm max-w-md mb-6">
                Click "Generate with AI" to create this sequence using your project&apos;s Brand DNA and voice profile, or "Load Demo Data" to see example emails.
              </p>
            </div>
          )}

          {/* Email cards */}
          {activeSeq && activeSeq.emails.map((email) => (
            <EmailCard key={email.id} email={email} />
          ))}
        </div>
      </main>
    </div>
  );
}

// ---- Email Card Component ----

function EmailCard({ email }: { email: EmailSequenceEmail }) {
  const [expandedBody, setExpandedBody] = useState(false);

  return (
    <div className="mb-6 bg-bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-bg-input/50">
        <div className="flex items-center gap-3">
          <span className="text-accent-orange font-bold text-sm">#{email.position}</span>
          <span className="text-text-muted text-xs font-mono">{email.send_timing}</span>
        </div>
      </div>

      {/* Subject Lines */}
      <div className="px-5 py-4 border-b border-border">
        <div className="text-text-muted text-xs uppercase tracking-wider mb-2">Subject Lines</div>
        <div className="space-y-2">
          {email.subject_lines.map((sl) => (
            <div key={sl.variant} className="flex items-start gap-2">
              <span className={`
                flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold
                ${sl.variant === 'A' ? 'bg-accent-teal/20 text-accent-teal' :
                  sl.variant === 'B' ? 'bg-accent-orange/20 text-accent-orange' :
                  'bg-purple-500/20 text-purple-400'}
              `}>
                {sl.variant}
              </span>
              <span className="text-text-primary text-sm">{sl.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Preview Text */}
      <div className="px-5 py-3 border-b border-border">
        <div className="text-text-muted text-xs uppercase tracking-wider mb-1">Preview Text</div>
        <p className="text-text-secondary text-sm italic">{email.preview_text}</p>
      </div>

      {/* Body */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="text-text-muted text-xs uppercase tracking-wider">Email Body</div>
          <button
            onClick={() => setExpandedBody(!expandedBody)}
            className="text-text-muted text-xs hover:text-accent-teal transition-colors"
          >
            {expandedBody ? 'Collapse' : 'Expand'}
          </button>
        </div>
        <div
          className={`
            text-text-secondary text-sm leading-relaxed email-body-content
            ${!expandedBody ? 'max-h-40 overflow-hidden relative' : ''}
          `}
        >
          <div dangerouslySetInnerHTML={{ __html: email.body }} />
          {!expandedBody && (
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-bg-card to-transparent" />
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="px-5 py-3 flex items-center justify-between">
        <div>
          <div className="text-text-muted text-xs uppercase tracking-wider mb-1">CTA Button</div>
          <span className="inline-block px-4 py-1.5 rounded-md bg-accent-orange/20 text-accent-orange text-sm font-medium">
            {email.cta_text}
          </span>
        </div>
      </div>
    </div>
  );
}
