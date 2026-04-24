'use client';

// ============================================================
// PAWEN — /project/[id]/agent-chat   (Phase V.6)
//
// Multi-agent chat room. Split-pane layout:
//   LEFT 65%  — thread with auto-scroll + user composer
//   RIGHT 35% — sidebar: metadata, participants, past conversations, close
//
// All routing + agent turns run server-side. The page polls the full
// thread after each user post (no SSE in V1 — keeps client simple).
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AGENT_PERSONAS } from '@/lib/agents/personas';
import type { AgentId, Conversation, ConversationMessage } from '@/lib/kb/types';

const AGENT_BG: Record<string, string> = {
  sarah:  'bg-blue-500/10 border-blue-500/30',
  marcus: 'bg-purple-500/10 border-purple-500/30',
  alex:   'bg-amber-500/10 border-amber-500/30',
  nina:   'bg-pink-500/10 border-pink-500/30',
  david:  'bg-emerald-500/10 border-emerald-500/30',
  lea:    'bg-accent-orange/10 border-accent-orange/30',
  scout:  'bg-teal-500/10 border-teal-500/30',
  system: 'bg-neutral-800 border-border',
};

const AGENT_META: Record<string, { emoji: string; name: string; role: string }> = {
  sarah:  { emoji: '🧠', name: 'Sarah',  role: 'Strategist' },
  marcus: { emoji: '🔍', name: 'Marcus', role: 'Customer Research' },
  alex:   { emoji: '✍️', name: 'Alex',   role: 'Copywriter' },
  nina:   { emoji: '🎨', name: 'Nina',   role: 'Creative Director' },
  david:  { emoji: '📊', name: 'David',  role: 'Media Buyer' },
  lea:    { emoji: '👑', name: 'Léa',    role: 'PM / Director' },
  scout:  { emoji: '🛰️', name: 'Scout',  role: 'Signal Intelligence' },
  system: { emoji: '⚙️', name: 'System', role: '' },
};

const DEFAULT_PARTICIPANTS = ['sarah', 'marcus', 'alex', 'nina', 'david', 'lea', 'scout'];

interface ApiResponse {
  ok: boolean;
  conversation?: Conversation;
  messages?: ConversationMessage[];
  rows?: Conversation[];
  message?: string;
}

export default function AgentChatPage() {
  const routeParams = useParams<{ id: string }>();
  const projectId = routeParams.id;

  const [enabled] = useState(process.env.NEXT_PUBLIC_CONVERSATIONS_ENABLED === '1');
  const [projectConvs, setProjectConvs] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [topicInput, setTopicInput] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(DEFAULT_PARTICIPANTS);
  const [composer, setComposer] = useState('');
  const [posting, setPosting] = useState(false);

  const threadRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    try {
      const res = await fetch(`/api/conversations?projectId=${encodeURIComponent(projectId)}`, { credentials: 'same-origin' });
      const data = await res.json() as ApiResponse;
      if (data.ok && Array.isArray(data.rows)) setProjectConvs(data.rows);
    } catch { /* silent */ }
  }, [projectId]);

  const loadConv = useCallback(async (id: string) => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`, { credentials: 'same-origin' });
      const data = await res.json() as ApiResponse;
      if (data.ok && data.conversation) {
        setActiveConv(data.conversation);
        setMessages(data.messages ?? []);
      } else {
        setErr(data.message ?? 'Failed to load conversation');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    // Auto-scroll to bottom when messages change
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function handleStart() {
    if (!topicInput.trim() || !firstMessage.trim()) {
      setErr('Topic and first message are required');
      return;
    }
    setPosting(true); setErr(null);
    try {
      const res = await fetch('/api/conversations/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          projectId,
          topic: topicInput.trim(),
          participants: selectedParticipants,
          firstMessage: { content: firstMessage.trim(), authorType: 'user' },
          maxChainLength: 3,
        }),
      });
      const data = await res.json() as ApiResponse;
      if (data.ok && data.conversation) {
        setActiveConv(data.conversation);
        setMessages(data.messages ?? []);
        setTopicInput(''); setFirstMessage('');
        void loadList();
      } else {
        setErr(data.message ?? 'Failed to start conversation');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Network error');
    } finally {
      setPosting(false);
    }
  }

  async function handlePost() {
    if (!activeConv || !composer.trim()) return;
    setPosting(true); setErr(null);
    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(activeConv.id)}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ content: composer.trim(), maxChainLength: 3 }),
      });
      const data = await res.json() as ApiResponse;
      if (data.ok && data.conversation) {
        setActiveConv(data.conversation);
        setMessages(data.messages ?? []);
        setComposer('');
      } else {
        setErr(data.message ?? 'Post failed');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Network error');
    } finally {
      setPosting(false);
    }
  }

  async function handleClose() {
    if (!activeConv) return;
    if (!window.confirm('Close this conversation? Léa will write a summary.')) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(activeConv.id)}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ askLeaSummary: true }),
      });
      const data = await res.json() as ApiResponse;
      if (data.ok && data.conversation) {
        setActiveConv(data.conversation);
        await loadConv(data.conversation.id);
        void loadList();
      }
    } finally {
      setPosting(false);
    }
  }

  const toggleParticipant = (id: string) => {
    setSelectedParticipants(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id],
    );
  };

  const cap = 30;
  const capPct = useMemo(
    () => activeConv ? Math.min(100, (activeConv.messageCount / cap) * 100) : 0,
    [activeConv],
  );

  if (!enabled) {
    return (
      <div className="min-h-screen bg-bg-primary p-8 text-text-primary">
        <div className="max-w-2xl mx-auto bg-bg-card border border-border rounded-lg p-6 mt-12">
          <h1 className="text-xl font-semibold mb-2">Agent Chat Room — disabled</h1>
          <p className="text-text-muted text-sm mb-4">
            Phase V feature flag is OFF. Set <code className="bg-black/40 px-1 rounded">NEXT_PUBLIC_CONVERSATIONS_ENABLED=1</code> in Vercel env and redeploy.
          </p>
          <Link href={`/project/${projectId}`} className="text-accent-orange hover:underline">← Back to project</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <header className="border-b border-border bg-bg-card px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-semibold">Agent Chat Room</h1>
          <p className="text-text-muted text-xs">Project {projectId}</p>
        </div>
        <Link href={`/project/${projectId}`} className="text-sm text-text-secondary hover:text-accent-orange">← Project</Link>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] min-h-[calc(100vh-56px)]">
        {/* LEFT: thread */}
        <div className="border-r border-border flex flex-col">
          {!activeConv && (
            <div className="p-6 space-y-4 max-w-xl mx-auto w-full">
              <h2 className="text-lg font-semibold">Start a conversation</h2>
              <input
                type="text"
                placeholder="Topic (e.g. should we re-run G4 on the MenoItaly drop?)"
                value={topicInput}
                onChange={e => setTopicInput(e.target.value)}
                className="w-full px-3 py-2 bg-bg-card border border-border rounded-md"
              />
              <textarea
                placeholder="First message — what do you want to discuss?"
                value={firstMessage}
                onChange={e => setFirstMessage(e.target.value)}
                className="w-full px-3 py-2 bg-bg-card border border-border rounded-md h-28 resize-none"
              />
              <div>
                <p className="text-xs text-text-muted mb-2">Participants (default all)</p>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_PARTICIPANTS.map(id => {
                    const meta = AGENT_META[id];
                    const on = selectedParticipants.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleParticipant(id)}
                        className={`px-3 py-1 text-xs rounded-md border ${on ? 'bg-accent-orange/20 border-accent-orange' : 'bg-bg-card border-border text-text-muted'}`}
                      >
                        {meta.emoji} {meta.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                type="button"
                disabled={posting}
                onClick={handleStart}
                className="w-full px-4 py-2 bg-accent-orange text-black rounded-md font-medium disabled:opacity-50"
              >
                {posting ? 'Starting…' : 'Start conversation'}
              </button>
              {err && <p className="text-red-400 text-sm">{err}</p>}
            </div>
          )}

          {activeConv && (
            <>
              <div ref={threadRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map(m => <MessageRow key={m.id} msg={m} />)}
                {messages.length === 0 && <p className="text-text-muted text-sm">No messages yet.</p>}
              </div>
              <div className="border-t border-border p-3 bg-bg-card">
                {activeConv.status === 'closed' ? (
                  <div className="text-text-muted text-sm italic">
                    Conversation closed.{activeConv.summary ? ` Summary: ${activeConv.summary}` : ''}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <textarea
                      placeholder="Your message · tag @marcus / @alex / etc. to route · or emit SCRAPE_REQUEST: …"
                      value={composer}
                      onChange={e => setComposer(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          void handlePost();
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-bg-primary border border-border rounded-md h-20 resize-none text-sm"
                    />
                    <button
                      type="button"
                      disabled={posting || !composer.trim()}
                      onClick={handlePost}
                      className="px-4 py-2 bg-accent-orange text-black rounded-md font-medium disabled:opacity-50 self-end"
                    >
                      {posting ? 'Posting…' : 'Send'}
                    </button>
                  </div>
                )}
                {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
              </div>
            </>
          )}
        </div>

        {/* RIGHT: sidebar */}
        <aside className="p-4 space-y-4 bg-bg-card overflow-y-auto">
          {activeConv ? (
            <>
              <section className="space-y-1">
                <h3 className="text-sm font-semibold">{activeConv.title}</h3>
                <p className="text-xs text-text-muted">{activeConv.topic}</p>
                <p className="text-xs text-text-muted">Initiator: {activeConv.initiator} · {activeConv.status}</p>
              </section>

              <section className="space-y-1">
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>Messages</span>
                  <span className={activeConv.messageCount > 25 ? 'text-red-400 font-semibold' : ''}>
                    {activeConv.messageCount} / {cap}
                  </span>
                </div>
                <div className="h-1.5 bg-black/40 rounded overflow-hidden">
                  <div className={`h-full ${capPct > 83 ? 'bg-red-500' : 'bg-accent-orange'}`} style={{ width: `${capPct}%` }} />
                </div>
                <p className="text-xs text-text-muted pt-1">Cost: ${activeConv.costUsd.toFixed(4)} · {activeConv.tokenCost.toLocaleString()} tokens</p>
              </section>

              <section className="space-y-2">
                <h4 className="text-xs font-semibold text-text-muted uppercase">Participants</h4>
                <div className="flex flex-wrap gap-1">
                  {activeConv.participants.map(id => {
                    const meta = AGENT_META[id] ?? AGENT_META.system;
                    return (
                      <span key={id} className="text-xs px-2 py-0.5 rounded border border-border">
                        {meta.emoji} {meta.name}
                      </span>
                    );
                  })}
                </div>
              </section>

              {activeConv.status === 'active' && (
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full px-3 py-2 text-sm border border-border rounded-md hover:border-red-400 hover:text-red-400"
                >
                  Close conversation
                </button>
              )}
            </>
          ) : (
            <p className="text-text-muted text-sm">Start or pick a conversation →</p>
          )}

          <section className="space-y-2 pt-4 border-t border-border">
            <h4 className="text-xs font-semibold text-text-muted uppercase">Past conversations</h4>
            {projectConvs.length === 0 && <p className="text-xs text-text-muted italic">None yet.</p>}
            <ul className="space-y-1">
              {projectConvs.map(c => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => void loadConv(c.id)}
                    className={`w-full text-left text-xs px-2 py-1 rounded border ${activeConv?.id === c.id ? 'border-accent-orange bg-accent-orange/10' : 'border-transparent hover:border-border'}`}
                  >
                    <div className="truncate">{c.title}</div>
                    <div className="text-text-muted">{c.status} · {c.messageCount} msg · ${c.costUsd.toFixed(3)}</div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          {loading && <p className="text-text-muted text-xs">loading…</p>}
        </aside>
      </div>
    </div>
  );
}

function MessageRow({ msg }: { msg: ConversationMessage }) {
  const meta = AGENT_META[msg.authorId] ?? { emoji: '🧑', name: msg.authorId, role: '' };
  const bg = AGENT_BG[msg.authorId] ?? (msg.authorType === 'user' ? 'bg-accent-orange/10 border-accent-orange/30' : 'bg-neutral-800 border-border');
  const alignRight = msg.authorType === 'user';

  // Highlight @mentions and SCRAPE_REQUEST inline
  const rendered = useMemo(() => renderRich(msg.content), [msg.content]);

  return (
    <div className={`flex ${alignRight ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] border rounded-lg px-3 py-2 ${bg}`}>
        <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
          <span>{meta.emoji}</span>
          <span className="font-semibold text-text-primary">{meta.name}</span>
          {meta.role && <span className="text-text-muted">· {meta.role}</span>}
          {msg.modelUsed && <span className="text-text-muted">· {msg.modelUsed}</span>}
          <span className="ml-auto">{new Date(msg.createdAt).toLocaleTimeString()}</span>
        </div>
        <div className="text-sm whitespace-pre-wrap">{rendered}</div>
        {typeof msg.costUsd === 'number' && msg.costUsd > 0 && (
          <div className="text-[10px] text-text-muted mt-1">${msg.costUsd.toFixed(4)}</div>
        )}
      </div>
    </div>
  );
}

function renderRich(text: string): Array<string | React.ReactElement> {
  // Split on @mentions and SCRAPE_REQUEST: / CLOSE_CONVERSATION: lines
  const parts: Array<string | React.ReactElement> = [];
  const lines = text.split('\n');
  let key = 0;
  for (const line of lines) {
    if (/^\s*SCRAPE_REQUEST\s*:/.test(line)) {
      parts.push(<div key={`k${key++}`} className="inline-block px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 text-xs font-mono my-1">{line.trim()}</div>);
      parts.push('\n');
      continue;
    }
    if (/^\s*CLOSE_CONVERSATION\s*:/.test(line)) {
      parts.push(<div key={`k${key++}`} className="inline-block px-2 py-0.5 rounded bg-accent-orange/30 text-accent-orange text-xs font-mono my-1">{line.trim()}</div>);
      parts.push('\n');
      continue;
    }
    // @mentions
    const segs = line.split(/(@(?:sarah|marcus|alex|nina|david|lea|scout))/gi);
    for (const seg of segs) {
      if (/^@(?:sarah|marcus|alex|nina|david|lea|scout)$/i.test(seg)) {
        parts.push(<span key={`k${key++}`} className="text-accent-orange font-semibold">{seg.toLowerCase()}</span>);
      } else {
        parts.push(seg);
      }
    }
    parts.push('\n');
  }
  return parts;
}
