'use client';

// ============================================================
// PAWEN — /agents/[agentId]/chat   (1-on-1 with a single agent)
//
// Direct chat with one agent. Each user message has a "Save as rule"
// button — clicking it stores that message as a confidence-10
// `user_directive` memory for the agent. From the next prompt onwards
// the agent sees it under === USER DIRECTIVES === in their system
// prompt and is instructed to comply.
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { v4 as uuid } from 'uuid';
import { AGENT_PERSONAS } from '@/lib/agents/personas';
import { saveAgentMemory } from '@/lib/store/db';
import type { AgentId, AgentMemoryEntry } from '@/lib/kb/types';

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  savedAsRule?: boolean;
  tokens?: number;
}

export default function SoloAgentChatPage() {
  const params = useParams<{ agentId: string }>();
  const agentId = (params.agentId as AgentId);
  const persona = AGENT_PERSONAS[agentId];

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [composer, setComposer] = useState('');
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const apiPayload = useMemo(
    () => messages.map(m => ({ role: m.role, content: m.content })),
    [messages],
  );

  if (!persona) {
    return (
      <div className="min-h-screen bg-bg-primary text-white p-8">
        <p className="text-white/60">Unknown agent: {agentId}</p>
        <Link href="/hive" className="text-amber-300 hover:underline">← Hive</Link>
      </div>
    );
  }

  async function handleSend() {
    const text = composer.trim();
    if (!text) return;
    setPosting(true); setErr(null);
    const userMsg: ChatMsg = { id: uuid(), role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setComposer('');
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ messages: next.map(m => ({ role: m.role, content: m.content })) }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`HTTP ${res.status}: ${detail.slice(0, 200)}`);
      }
      const data = await res.json() as { ok: boolean; reply?: string; tokens?: number; message?: string };
      if (!data.ok || !data.reply) throw new Error(data.message ?? 'empty reply');
      setMessages(prev => [...prev, { id: uuid(), role: 'assistant', content: data.reply!, tokens: data.tokens }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'send failed');
      setMessages(prev => prev.slice(0, -1)); // roll back the user msg on error
      setComposer(text);
    } finally {
      setPosting(false);
    }
  }

  async function handleSaveAsRule(msg: ChatMsg) {
    if (msg.savedAsRule) return;
    const entry: AgentMemoryEntry = {
      id: uuid(),
      agentId,
      projectId: null,
      type: 'user_directive',
      title: msg.content.slice(0, 80) + (msg.content.length > 80 ? '…' : ''),
      content: msg.content,
      confidence: 10,
      context: '1-on-1 chat',
      createdAt: new Date().toISOString(),
    };
    await saveAgentMemory(entry);
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, savedAsRule: true } : m));
  }

  return (
    <div className="min-h-screen bg-bg-primary text-white flex flex-col">
      <header className="border-b border-white/10 px-6 py-4 flex items-center gap-3">
        <Link href="/hive" className="text-white/40 hover:text-white text-sm">← Hive</Link>
        <span className="text-white/20">·</span>
        <span className="text-3xl">{persona.emoji}</span>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">{persona.name}</h1>
          <p className="text-white/40 text-xs">{persona.role} · 1-on-1</p>
        </div>
      </header>

      <div ref={threadRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-3">
        {messages.length === 0 && (
          <div className="max-w-md mx-auto mt-12 text-center text-white/50 text-sm space-y-2">
            <p>Talk directly to {persona.name}.</p>
            <p className="text-xs italic">
              {persona.decisionStyle.slice(0, 140)}
            </p>
            <p className="text-white/40 pt-3">
              Hit <kbd className="px-1 border border-white/20 rounded">Save as rule</kbd> on any message to lock it as a permanent directive in their memory.
            </p>
          </div>
        )}
        {messages.map(m => {
          const isUser = m.role === 'user';
          return (
            <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[78%] rounded-xl px-4 py-2.5 ${
                isUser ? 'bg-accent-orange/15 border border-accent-orange/30' : 'bg-white/5 border border-white/10'
              }`}>
                {!isUser && <div className="text-xs text-white/40 mb-1">{persona.emoji} {persona.name}</div>}
                <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                {isUser && (
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={!!m.savedAsRule}
                      onClick={() => handleSaveAsRule(m)}
                      className={`text-[11px] px-2 py-0.5 rounded border ${
                        m.savedAsRule
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                          : 'border-white/20 text-white/60 hover:text-white hover:border-white/40'
                      }`}
                    >
                      {m.savedAsRule ? '✓ saved as rule' : '💾 save as rule'}
                    </button>
                  </div>
                )}
                {!isUser && typeof m.tokens === 'number' && (
                  <div className="text-[10px] text-white/30 mt-1">{m.tokens.toLocaleString()} tokens</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-white/10 px-6 py-4">
        {err && <p className="text-red-400 text-xs mb-2">{err}</p>}
        <div className="flex gap-2 max-w-3xl mx-auto">
          <textarea
            value={composer}
            onChange={e => setComposer(e.target.value)}
            placeholder={`Message ${persona.name} directly… (Ctrl+Enter to send)`}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleSend();
              }
            }}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm h-20 resize-none focus:outline-none focus:border-amber-400/40"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={posting || !composer.trim()}
            className="px-4 self-end py-2 bg-accent-orange text-black rounded-lg font-medium disabled:opacity-50"
          >
            {posting ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
