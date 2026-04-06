'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TrainingSource, KnowledgeEntry } from '@/lib/kb/types';
import { getAllTrainingSources, getAllKnowledge, deleteTrainingSource } from '@/lib/store/db';
import { ingestTraining } from '@/lib/kb/ingest';

export default function TrainingPage() {
  const [sources, setSources] = useState<TrainingSource[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0, entries: 0 });
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<TrainingSource['type']>('course');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [s, k] = await Promise.all([getAllTrainingSources(), getAllKnowledge()]);
    setSources(s);
    setKnowledge(k);
    setLoading(false);
  }

  async function handleIngest() {
    if (!name.trim() || !content.trim()) return;
    setIsIngesting(true);
    setProgress({ processed: 0, total: 0, entries: 0 });

    try {
      await ingestTraining({
        name: name.trim(),
        description: description.trim(),
        content: content.trim(),
        type,
        onProgress: (processed, total, entryCount) => {
          setProgress({ processed, total, entries: entryCount });
        },
      });

      setName('');
      setDescription('');
      setContent('');
      setShowUpload(false);
      await loadData();
    } catch (err) {
      console.error('Ingestion failed:', err);
    } finally {
      setIsIngesting(false);
    }
  }

  async function handleDelete(sourceId: string) {
    if (!confirm('Delete this training source and all its knowledge entries?')) return;
    await deleteTrainingSource(sourceId);
    await loadData();
  }

  const filteredKnowledge = selectedSource
    ? knowledge.filter(k => k.sourceId === selectedSource)
    : knowledge;

  const categoryStats = knowledge.reduce((acc, k) => {
    acc[k.category] = (acc[k.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="border-b border-border bg-bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-text-muted hover:text-text-primary text-sm">&larr; Dashboard</Link>
            <div>
              <h1 className="text-xl font-bold text-accent-orange">Training Center</h1>
              <p className="text-text-muted text-xs">Upload courses and documents to train your agents</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/agents" className="px-4 py-2 border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-text-muted text-sm">
              View Team
            </Link>
            <button
              onClick={() => setShowUpload(true)}
              className="px-4 py-2 bg-accent-orange text-white font-semibold rounded-lg hover:bg-accent-orange-hover text-sm"
            >
              + Upload Training
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-bg-card border border-border rounded-xl p-4">
            <p className="text-text-muted text-xs">Training Sources</p>
            <p className="text-2xl font-bold text-text-primary">{sources.length}</p>
          </div>
          <div className="bg-bg-card border border-border rounded-xl p-4">
            <p className="text-text-muted text-xs">Knowledge Entries</p>
            <p className="text-2xl font-bold text-text-primary">{knowledge.length}</p>
          </div>
          <div className="bg-bg-card border border-border rounded-xl p-4">
            <p className="text-text-muted text-xs">Categories Covered</p>
            <p className="text-2xl font-bold text-text-primary">{Object.keys(categoryStats).length}</p>
          </div>
        </div>

        {/* Upload modal */}
        {showUpload && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h2 className="text-lg font-semibold text-text-primary">Upload Training Material</h2>
                <button onClick={() => !isIngesting && setShowUpload(false)} className="text-text-muted hover:text-text-primary">X</button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-text-secondary text-sm mb-1.5">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., ZAK Scaling Masterclass"
                    className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-orange text-sm"
                    disabled={isIngesting}
                  />
                </div>
                <div>
                  <label className="block text-text-secondary text-sm mb-1.5">Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the training content"
                    className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-orange text-sm"
                    disabled={isIngesting}
                  />
                </div>
                <div>
                  <label className="block text-text-secondary text-sm mb-1.5">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as TrainingSource['type'])}
                    className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent-orange text-sm"
                    disabled={isIngesting}
                  >
                    <option value="course">Course / Formation</option>
                    <option value="document">Document</option>
                    <option value="video_transcript">Video Transcript</option>
                  </select>
                </div>
                <div>
                  <label className="block text-text-secondary text-sm mb-1.5">
                    Content <span className="text-text-muted">(paste the full text)</span>
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Paste the entire course content, document text, or video transcript here..."
                    rows={12}
                    className="w-full px-4 py-3 bg-bg-input border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-orange text-sm font-mono resize-y"
                    disabled={isIngesting}
                  />
                  <p className="text-text-muted text-xs mt-1">
                    {content.length > 0 ? `${content.length.toLocaleString()} characters` : 'No content yet'}
                  </p>
                </div>

                {isIngesting && (
                  <div className="p-4 bg-accent-orange/10 border border-accent-orange/30 rounded-lg">
                    <p className="text-sm text-accent-orange font-medium">
                      Processing chunk {progress.processed}/{progress.total}...
                    </p>
                    <p className="text-xs text-text-secondary mt-1">
                      {progress.entries} knowledge entries extracted so far
                    </p>
                    <div className="mt-2 h-1.5 bg-bg-primary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-orange rounded-full transition-all"
                        style={{ width: progress.total > 0 ? `${(progress.processed / progress.total) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowUpload(false)}
                    disabled={isIngesting}
                    className="flex-1 py-2.5 border border-border rounded-lg text-text-secondary hover:text-text-primary text-sm disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleIngest}
                    disabled={isIngesting || !name.trim() || !content.trim()}
                    className="flex-1 py-2.5 bg-accent-orange text-white font-semibold rounded-lg hover:bg-accent-orange-hover text-sm disabled:opacity-50"
                  >
                    {isIngesting ? 'Processing...' : 'Train Agents'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-text-secondary">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Training Sources */}
            <div className="lg:col-span-1 space-y-3">
              <h2 className="text-sm font-semibold text-text-secondary mb-3">Training Sources</h2>
              {sources.length === 0 ? (
                <div className="bg-bg-card border border-border rounded-xl p-6 text-center">
                  <p className="text-text-muted text-sm">No training yet</p>
                  <p className="text-text-muted text-xs mt-1">Upload courses to train your agents</p>
                </div>
              ) : (
                sources.map((source) => (
                  <div
                    key={source.id}
                    onClick={() => setSelectedSource(selectedSource === source.id ? null : source.id)}
                    className={`bg-bg-card border rounded-xl p-4 cursor-pointer hover:bg-bg-card-hover ${
                      selectedSource === source.id ? 'border-accent-orange' : 'border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-text-primary text-sm truncate">{source.name}</h3>
                        <p className="text-text-muted text-xs mt-0.5">{source.description}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(source.id); }}
                        className="text-text-muted hover:text-error text-xs ml-2"
                      >
                        X
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-text-muted">
                      <span className="px-1.5 py-0.5 bg-bg-primary rounded">{source.type}</span>
                      <span>{source.entryCount} entries</span>
                      <span className={source.status === 'ready' ? 'text-success' : 'text-warning'}>
                        {source.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Right: Knowledge Entries */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-text-secondary">
                  Knowledge Entries {selectedSource ? '(filtered)' : '(all)'}
                </h2>
                {selectedSource && (
                  <button
                    onClick={() => setSelectedSource(null)}
                    className="text-xs text-accent-orange hover:underline"
                  >
                    Show all
                  </button>
                )}
              </div>

              {/* Category filter pills */}
              {Object.keys(categoryStats).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {Object.entries(categoryStats).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                    <span key={cat} className="text-xs px-2 py-0.5 bg-bg-card border border-border rounded-md text-text-secondary">
                      {cat.replace(/_/g, ' ')} ({count})
                    </span>
                  ))}
                </div>
              )}

              {filteredKnowledge.length === 0 ? (
                <div className="bg-bg-card border border-border rounded-xl p-8 text-center">
                  <p className="text-text-muted">No knowledge entries yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filteredKnowledge.map((entry) => (
                    <div key={entry.id} className="bg-bg-card border border-border rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <h4 className="text-sm font-medium text-text-primary">{entry.title}</h4>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          entry.importance === 'critical' ? 'bg-error/20 text-error' :
                          entry.importance === 'important' ? 'bg-warning/20 text-warning' :
                          'bg-bg-primary text-text-muted'
                        }`}>
                          {entry.importance}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">{entry.keyTakeaway}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className="text-xs px-1.5 py-0.5 bg-accent-teal/20 text-accent-teal rounded">
                          {entry.category.replace(/_/g, ' ')}
                        </span>
                        {entry.applicableGates.slice(0, 3).map(g => (
                          <span key={g} className="text-xs px-1.5 py-0.5 bg-bg-primary text-text-muted rounded">
                            {g}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
