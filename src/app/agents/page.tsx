'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AGENT_PERSONAS } from '@/lib/agents/personas';
import { getAgentMemoryStats } from '@/lib/agents/memory';
import { getAllKnowledge } from '@/lib/store/db';
import { AgentPersona, AgentId, AgentMemoryEntry } from '@/lib/kb/types';
import { getAgentMemories } from '@/lib/store/db';

export default function AgentsPage() {
  const [memoryStats, setMemoryStats] = useState<Record<AgentId, number>>({} as Record<AgentId, number>);
  const [knowledgeCount, setKnowledgeCount] = useState(0);
  const [selectedAgent, setSelectedAgent] = useState<AgentId | null>(null);
  const [agentMemories, setAgentMemories] = useState<AgentMemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [stats, kb] = await Promise.all([getAgentMemoryStats(), getAllKnowledge()]);
      setMemoryStats(stats);
      setKnowledgeCount(kb.length);
      setLoading(false);
    }
    load();
  }, []);

  async function selectAgent(id: AgentId) {
    setSelectedAgent(id);
    const memories = await getAgentMemories(id);
    setAgentMemories(memories.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ));
  }

  const agents = Object.values(AGENT_PERSONAS);
  const totalMemories = Object.values(memoryStats).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="border-b border-border bg-bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-text-muted hover:text-text-primary text-sm">&larr; Dashboard</Link>
            <div>
              <h1 className="text-xl font-bold text-accent-orange">Agent Team</h1>
              <p className="text-text-muted text-xs">Your autonomous AI agency team</p>
            </div>
          </div>
          <Link href="/training" className="px-4 py-2 bg-accent-orange text-white font-semibold rounded-lg hover:bg-accent-orange-hover text-sm">
            Training Center
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-bg-card border border-border rounded-xl p-4">
            <p className="text-text-muted text-xs">Active Agents</p>
            <p className="text-2xl font-bold text-text-primary">{agents.length}</p>
          </div>
          <div className="bg-bg-card border border-border rounded-xl p-4">
            <p className="text-text-muted text-xs">Total Memories</p>
            <p className="text-2xl font-bold text-text-primary">{totalMemories}</p>
          </div>
          <div className="bg-bg-card border border-border rounded-xl p-4">
            <p className="text-text-muted text-xs">KB Entries Available</p>
            <p className="text-2xl font-bold text-text-primary">{knowledgeCount}</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-text-secondary">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Agent cards */}
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  memoryCount={memoryStats[agent.id] || 0}
                  isSelected={selectedAgent === agent.id}
                  onClick={() => selectAgent(agent.id)}
                />
              ))}
            </div>

            {/* Agent detail panel */}
            <div className="lg:col-span-1">
              {selectedAgent ? (
                <AgentDetail
                  agent={AGENT_PERSONAS[selectedAgent]}
                  memories={agentMemories}
                />
              ) : (
                <div className="bg-bg-card border border-border rounded-xl p-6 text-center">
                  <p className="text-text-muted text-sm">Select an agent to view details</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function AgentCard({
  agent,
  memoryCount,
  isSelected,
  onClick,
}: {
  agent: AgentPersona;
  memoryCount: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-bg-card border rounded-xl p-5 cursor-pointer hover:bg-bg-card-hover ${
        isSelected ? 'border-accent-orange' : 'border-border'
      }`}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{agent.emoji}</span>
        <div>
          <h3 className="font-semibold text-text-primary">{agent.name}</h3>
          <p className="text-xs text-accent-teal">{agent.role}</p>
        </div>
      </div>
      <p className="text-xs text-text-secondary line-clamp-2 mb-3">
        {agent.personality.split('.')[0]}.
      </p>
      <div className="flex items-center gap-3 text-xs text-text-muted">
        <span>Gates: {agent.gates.map(g => g.replace('gate', 'G').replace('brand-dna', 'DNA')).join(', ')}</span>
        <span>{memoryCount} memories</span>
      </div>
    </div>
  );
}

function AgentDetail({
  agent,
  memories,
}: {
  agent: AgentPersona;
  memories: AgentMemoryEntry[];
}) {
  return (
    <div className="space-y-4">
      {/* Agent profile */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">{agent.emoji}</span>
          <div>
            <h3 className="text-lg font-bold text-text-primary">{agent.name}</h3>
            <p className="text-sm text-accent-teal">{agent.role}</p>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <p className="text-text-muted font-medium mb-1">Personality</p>
            <p className="text-text-secondary">{agent.personality}</p>
          </div>
          <div>
            <p className="text-text-muted font-medium mb-1">Decision Style</p>
            <p className="text-text-secondary">{agent.decisionStyle}</p>
          </div>
          <div>
            <p className="text-text-muted font-medium mb-1">Expertise</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {agent.expertise.map((exp) => (
                <span key={exp} className="px-2 py-0.5 bg-bg-primary border border-border rounded text-text-secondary">
                  {exp}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Agent memories */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <h4 className="text-sm font-semibold text-text-secondary mb-3">
          Memories ({memories.length})
        </h4>
        {memories.length === 0 ? (
          <p className="text-xs text-text-muted">No memories yet. This agent will learn from working on projects.</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {memories.map((mem) => (
              <div key={mem.id} className="p-2 bg-bg-primary rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-primary">{mem.title}</span>
                  <span className="text-xs text-text-muted">
                    {mem.confidence}/10
                  </span>
                </div>
                <p className="text-xs text-text-secondary mt-0.5">{mem.content.slice(0, 150)}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                  <span className={`px-1 py-0.5 rounded ${
                    mem.type === 'learning' ? 'bg-success/20 text-success' :
                    mem.type === 'opinion' ? 'bg-accent-teal/20 text-accent-teal' :
                    mem.type === 'decision' ? 'bg-warning/20 text-warning' :
                    'bg-bg-card text-text-muted'
                  }`}>
                    {mem.type}
                  </span>
                  <span>{new Date(mem.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
