'use client';

import { useEffect, useState } from 'react';
import { Project } from '@/lib/types';
import { getAllProjects, saveProject, deleteProject } from '@/lib/store/db';
import { createProject, getProgressPercentage, getCompletedGateCount, ALL_GATES } from '@/lib/store/project-utils';
import Link from 'next/link';

const LANGUAGES = [
  { code: 'en-US', label: 'English (US)', market: 'United States' },
  { code: 'es-ES', label: 'Español (Spain)', market: 'Spain' },
  { code: 'fr-FR', label: 'Français', market: 'France' },
  { code: 'de-DE', label: 'Deutsch', market: 'Germany' },
  { code: 'it-IT', label: 'Italiano', market: 'Italy' },
  { code: 'pt-BR', label: 'Português (Brazil)', market: 'Brazil' },
  { code: 'ja-JP', label: '日本語', market: 'Japan' },
  { code: 'ko-KR', label: '한국어', market: 'South Korea' },
  { code: 'zh-CN', label: '中文 (Simplified)', market: 'China' },
  { code: 'ar-SA', label: 'العربية', market: 'Saudi Arabia' },
  { code: 'nl-NL', label: 'Nederlands', market: 'Netherlands' },
  { code: 'sv-SE', label: 'Svenska', market: 'Sweden' },
  { code: 'pl-PL', label: 'Polski', market: 'Poland' },
  { code: 'tr-TR', label: 'Türkçe', market: 'Turkey' },
  { code: 'hi-IN', label: 'हिन्दी', market: 'India' },
];

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showNewProject, setShowNewProject] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem('pawen-auth');
    if (auth === 'true') {
      setAuthenticated(true);
      loadProjects();
    } else {
      setLoading(false);
    }
  }, []);

  async function loadProjects() {
    setLoading(true);
    const all = await getAllProjects();
    setProjects(all);
    setLoading(false);
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (password === (process.env.NEXT_PUBLIC_PAWEN_PASSWORD || 'pawen2026')) {
      localStorage.setItem('pawen-auth', 'true');
      setAuthenticated(true);
      loadProjects();
    } else {
      setAuthError(true);
    }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="bg-bg-card border border-border rounded-xl p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-accent-orange">🐾 Pawen</h1>
            <p className="text-text-secondary text-sm mt-1">Command Center v4.0</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setAuthError(false); }}
              placeholder="Password"
              className="w-full px-4 py-3 bg-bg-input border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-orange"
              autoFocus
            />
            {authError && <p className="text-error text-sm">Wrong password</p>}
            <button
              type="submit"
              className="w-full py-3 bg-accent-orange text-white font-semibold rounded-lg hover:bg-accent-orange-hover"
            >
              Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="border-b border-border bg-bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-accent-orange">🐾 Pawen Command Center</h1>
            <p className="text-text-muted text-xs">Multi-agent AI pipeline — Any product, any language, any niche</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/agents" className="px-4 py-2 border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-text-muted text-sm">
              Agent Team
            </Link>
            <Link href="/training" className="px-4 py-2 border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-text-muted text-sm">
              Training
            </Link>
            <button
              onClick={() => setShowNewProject(true)}
              className="px-4 py-2 bg-accent-orange text-white font-semibold rounded-lg hover:bg-accent-orange-hover text-sm"
            >
              + New Project
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {showNewProject && (
          <NewProjectModal
            onClose={() => setShowNewProject(false)}
            onCreate={async (p) => {
              await saveProject(p);
              await loadProjects();
              setShowNewProject(false);
            }}
          />
        )}

        {loading ? (
          <div className="text-center py-20 text-text-secondary">Loading...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-text-secondary text-lg">No projects yet</p>
            <p className="text-text-muted text-sm mt-2">Create your first project to start the pipeline</p>
            <button
              onClick={() => setShowNewProject(true)}
              className="mt-6 px-6 py-3 bg-accent-orange text-white font-semibold rounded-lg hover:bg-accent-orange-hover"
            >
              + New Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={async () => {
                  await deleteProject(project.id);
                  await loadProjects();
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ProjectCard({ project, onDelete }: { project: Project; onDelete: () => void }) {
  const progress = getProgressPercentage(project);
  const completed = getCompletedGateCount(project);
  const total = ALL_GATES.length;

  return (
    <Link
      href={`/project/${project.id}`}
      className="bg-bg-card border border-border rounded-xl p-5 hover:bg-bg-card-hover hover:border-border-active group block"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-text-primary truncate group-hover:text-accent-orange">
            {project.name}
          </h3>
          <p className="text-text-muted text-xs mt-1 truncate">{project.productUrl}</p>
        </div>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (confirm('Delete this project?')) onDelete();
          }}
          className="text-text-muted hover:text-error text-sm ml-2 opacity-0 group-hover:opacity-100"
        >
          ✕
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-text-secondary">
        <span className="px-2 py-0.5 bg-bg-primary rounded-md">{project.targetLanguage}</span>
        <span className="px-2 py-0.5 bg-bg-primary rounded-md">{project.targetMarket}</span>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs text-text-muted mb-1">
          <span>{completed}/{total} gates</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 bg-bg-primary rounded-full overflow-hidden">
          <div className="h-full bg-accent-orange rounded-full" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <p className="text-text-muted text-xs mt-3">Updated {new Date(project.updatedAt).toLocaleDateString()}</p>
    </Link>
  );
}

function NewProjectModal({ onClose, onCreate }: { onClose: () => void; onCreate: (project: Project) => void }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [langIdx, setLangIdx] = useState(0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    const lang = LANGUAGES[langIdx];
    const project = createProject(name.trim(), url.trim(), description.trim(), lang.code, lang.market);
    onCreate(project);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border rounded-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">New Project</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-text-secondary text-sm mb-1.5">Project Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Dog Dental Probiotic — Spain"
              className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-orange text-sm"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="block text-text-secondary text-sm mb-1.5">Product URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://alibaba.com/... or https://amazon.com/..."
              className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-orange text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-text-secondary text-sm mb-1.5">Product Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the product, its benefits, target audience..."
              rows={3}
              className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-orange text-sm resize-none"
            />
          </div>
          <div>
            <label className="block text-text-secondary text-sm mb-1.5">Target Language & Market</label>
            <select
              value={langIdx}
              onChange={(e) => setLangIdx(Number(e.target.value))}
              className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent-orange text-sm"
            >
              {LANGUAGES.map((lang, i) => (
                <option key={lang.code} value={i}>{lang.label} — {lang.market}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-text-muted text-sm">
              Cancel
            </button>
            <button type="submit" className="flex-1 py-2.5 bg-accent-orange text-white font-semibold rounded-lg hover:bg-accent-orange-hover text-sm">
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
