'use client';

// ============================================================
// AutoEcom Lab — /contribute
// Team members drop knowledge (rules, examples, frameworks,
// anti-patterns, resources) segregated by agent. Optional file
// upload goes to Vercel Blob (private).
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { upload } from '@vercel/blob/client';
import { APP_USERS, type AppUser } from '@/lib/auth/users';
import { AGENT_IDS, CONTRIBUTION_TYPES, type AgentId, type ContributionType, type Contribution } from '@/lib/db/schema';

type AgentMeta = {
  id: AgentId;
  name: string;
  role: string;
  emoji: string;
  blurb: string;
};

const AGENTS: AgentMeta[] = [
  { id: 'marcus',  name: 'Marcus',  role: 'Customer Researcher',  emoji: '🔍', blurb: 'Avatars, voices, root causes, sub-avatars' },
  { id: 'alex',    name: 'Alex',    role: 'Copywriter',            emoji: '✍️', blurb: 'Hooks, advertorials, video scripts, body copy' },
  { id: 'nina',    name: 'Nina',    role: 'Creative Director',     emoji: '🎨', blurb: 'Image ads, visual composition, brand look' },
  { id: 'david',   name: 'David',   role: 'Media Buyer',           emoji: '📊', blurb: 'CBO structure, scaling, testing, kill rules' },
  { id: 'lea',     name: 'Léa',     role: 'PM / Director',         emoji: '👑', blurb: 'Quality control, brand DNA, workflow' },
  { id: 'sarah',   name: 'Sarah',   role: 'Strategist',            emoji: '🧠', blurb: 'Market fit, sophistication, positioning' },
  { id: 'general', name: 'General', role: 'Cross-agent knowledge', emoji: '🧩', blurb: 'Anything that applies to the whole pipeline' },
];

const TYPE_META: Record<ContributionType, { label: string; hint: string }> = {
  rule:           { label: 'Rule',         hint: 'A principle or heuristic ("Always X" / "Never Y")' },
  example:        { label: 'Example',      hint: 'A real ad, hook, case study — the raw material' },
  framework:      { label: 'Framework',    hint: 'A step-by-step process or checklist' },
  'anti-pattern': { label: 'Anti-pattern', hint: 'A mistake to avoid (and why it fails)' },
  resource:       { label: 'Resource',     hint: 'A course, link, doc — summarize the key takeaway' },
};

type AttachmentState = {
  url: string;
  pathname: string;
  name: string;
  size: number;
  type: string;
} | null;

export default function ContributePage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [agent, setAgent] = useState<AgentId>('marcus');
  const [type, setType] = useState<ContributionType>('rule');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [attachment, setAttachment] = useState<AttachmentState>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const [recent, setRecent] = useState<Contribution[]>([]);

  const loadRecent = useCallback(async (contributor: AppUser) => {
    try {
      const res = await fetch(`/api/contribute?contributor=${encodeURIComponent(contributor)}&limit=25`);
      const data = await res.json();
      if (data.ok) setRecent(data.contributions);
    } catch (err) {
      console.error('[contribute] loadRecent failed', err);
    }
  }, []);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('app-user') : null;
    if (stored && (APP_USERS as readonly string[]).includes(stored)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser(stored as AppUser);
      loadRecent(stored as AppUser);
    }
  }, [loadRecent]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    setFeedback(null);
    try {
      const pathname = `contributions/${user}/${Date.now()}-${file.name}`;
      const blob = await upload(pathname, file, {
        access: 'public',
        handleUploadUrl: '/api/contribute/upload',
        clientPayload: JSON.stringify({ user }),
      });
      setAttachment({
        url: blob.url,
        pathname: blob.pathname,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
      });
      console.log(`[contribute] uploaded ${file.name} → ${blob.url}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setFeedback({ ok: false, message: `Upload: ${msg}` });
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!title.trim() || !content.trim()) return;

    setSubmitting(true);
    setFeedback(null);
    try {
      const tags = tagsRaw
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      const res = await fetch('/api/contribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contributor: user,
          agent_id: agent,
          type,
          title,
          content,
          tags,
          attachment_url: attachment?.url ?? null,
          attachment_name: attachment?.name ?? null,
          attachment_size: attachment?.size ?? null,
          attachment_type: attachment?.type ?? null,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || 'Submit failed');

      setFeedback({ ok: true, message: 'Saved — thanks for contributing' });
      setTitle('');
      setContent('');
      setTagsRaw('');
      setAttachment(null);
      await loadRecent(user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Submit failed';
      setFeedback({ ok: false, message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="bg-bg-card border border-border rounded-xl p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold text-text-primary mb-2">Pick your user tag first</h1>
          <p className="text-text-secondary text-sm mb-4">
            Head back to the dashboard and select your name so your contributions get attributed to you.
          </p>
          <Link href="/" className="inline-block px-5 py-2.5 bg-accent-orange text-white rounded-lg hover:bg-accent-orange-hover text-sm font-semibold">
            Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const selectedAgent = AGENTS.find((a) => a.id === agent)!;

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="border-b border-border bg-bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-accent-orange">Knowledge Drop</h1>
            <p className="text-text-muted text-xs">Feed an agent — rules, examples, frameworks, mistakes</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 text-xs rounded-md bg-bg-primary border border-border text-text-secondary">
              {user}
            </span>
            <Link href="/" className="px-4 py-2 border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-text-muted text-sm">
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 grid md:grid-cols-3 gap-6">
        {/* Left col — form */}
        <form onSubmit={handleSubmit} className="md:col-span-2 space-y-5 bg-bg-card border border-border rounded-xl p-6">
          {/* Agent picker */}
          <div>
            <label className="block text-text-secondary text-sm mb-2">Which agent is this for?</label>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {AGENTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAgent(a.id)}
                  className={`text-left px-3 py-2.5 rounded-lg border text-sm ${
                    agent === a.id
                      ? 'border-accent-orange bg-accent-orange/10 text-text-primary'
                      : 'border-border text-text-secondary hover:border-text-muted'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{a.emoji}</span>
                    <span className="font-semibold">{a.name}</span>
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5">{a.role}</div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-text-muted mt-2">{selectedAgent.blurb}</p>
          </div>

          {/* Type */}
          <div>
            <label className="block text-text-secondary text-sm mb-2">Type</label>
            <div className="flex flex-wrap gap-2">
              {CONTRIBUTION_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`px-3 py-1.5 rounded-md text-xs border ${
                    type === t
                      ? 'border-accent-orange bg-accent-orange/10 text-accent-orange'
                      : 'border-border text-text-secondary hover:border-text-muted'
                  }`}
                >
                  {TYPE_META[t].label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-text-muted mt-1.5">{TYPE_META[type].hint}</p>
          </div>

          {/* Title */}
          <div>
            <label className="block text-text-secondary text-sm mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='e.g., "Hooks under 7 words convert 2x on sleep niche"'
              className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-orange text-sm"
              maxLength={200}
              required
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-text-secondary text-sm mb-1.5">
              Content <span className="text-text-muted">(markdown OK)</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write what you know. Be specific. Include examples. No fluff."
              rows={10}
              className="w-full px-4 py-3 bg-bg-input border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-orange text-sm font-mono"
              maxLength={20000}
              required
            />
            <p className="text-[11px] text-text-muted mt-1">{content.length}/20000</p>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-text-secondary text-sm mb-1.5">
              Tags <span className="text-text-muted">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="sleep, hooks, evergreen"
              className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-orange text-sm"
            />
          </div>

          {/* File upload */}
          <div>
            <label className="block text-text-secondary text-sm mb-1.5">
              Attach a file <span className="text-text-muted">(optional — PDF, image, doc, up to 20 MB)</span>
            </label>
            {!attachment ? (
              <input
                type="file"
                onChange={handleFileChange}
                disabled={uploading}
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="block w-full text-sm text-text-secondary file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-bg-input file:text-text-primary hover:file:bg-bg-card-hover"
              />
            ) : (
              <div className="flex items-center justify-between bg-bg-input border border-border rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary text-sm truncate">{attachment.name}</p>
                  <p className="text-text-muted text-[11px]">
                    {(attachment.size / 1024).toFixed(1)} KB · {attachment.type}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  className="ml-3 text-text-muted hover:text-error text-sm"
                >
                  ✕
                </button>
              </div>
            )}
            {uploading && <p className="text-[11px] text-text-muted mt-1">Uploading…</p>}
          </div>

          {/* Feedback */}
          {feedback && (
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                feedback.ok
                  ? 'bg-green-500/10 border border-green-500/30 text-green-500'
                  : 'bg-error/10 border border-error/30 text-error'
              }`}
            >
              {feedback.message}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || uploading || !title.trim() || !content.trim()}
            className="w-full py-3 bg-accent-orange text-white font-semibold rounded-lg hover:bg-accent-orange-hover disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {submitting ? 'Saving…' : 'Submit contribution'}
          </button>
        </form>

        {/* Right col — your recent contributions */}
        <aside className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Your recent drops</h2>
          {recent.length === 0 ? (
            <p className="text-text-muted text-xs">Nothing yet — be the first.</p>
          ) : (
            recent.map((c) => (
              <div key={c.id} className="bg-bg-card border border-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wide text-accent-orange">
                    {c.agent_id} · {c.type}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      c.status === 'pending'
                        ? 'bg-yellow-500/20 text-yellow-500'
                        : c.status === 'approved'
                        ? 'bg-green-500/20 text-green-500'
                        : c.status === 'merged'
                        ? 'bg-blue-500/20 text-blue-500'
                        : 'bg-error/20 text-error'
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
                <p className="text-text-primary text-sm font-medium truncate">{c.title}</p>
                <p className="text-text-muted text-[11px] mt-1">
                  {new Date(c.created_at).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </aside>
      </main>
    </div>
  );
}
