'use client';

import { useCallback, useEffect, useState } from 'react';
import { Project } from '@/lib/types';
import { getAllProjects, saveProject, deleteProject, restoreProject, restoreGateOutput } from '@/lib/store/db';
import { createProject, getProgressPercentage, getCompletedGateCount, ALL_GATES } from '@/lib/store/project-utils';
import { fetchBootstrap } from '@/lib/store/serverMirror';
import Link from 'next/link';

// NOTE: Client-side NEXT_PUBLIC_APP_PASSWORD and the hardcoded
// APP_USERS import are GONE. Everything goes through server
// endpoints: the password is checked by /api/auth/login and the
// user list comes from /api/auth/users. Sessions are HttpOnly
// cookies managed entirely server-side.

type PickerUser = { name: string; role: 'admin' | 'user' | 'blocked' };

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

  // --- Auth state (all server-side; no localStorage for auth) ---
  const [sessionChecked, setSessionChecked] = useState(false);
  const [appUser, setAppUser] = useState<string | null>(null);
  const [isAdminSession, setIsAdminSession] = useState(false);

  // --- Presence tracking ---
  const [onlineCount, setOnlineCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  // Two-step login: (1) password, (2) pick-user. Password is held in
  // state *only* until the picker submit, then cleared.
  const [pendingPassword, setPendingPassword] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [pickerUsers, setPickerUsers] = useState<PickerUser[]>([]);
  const [loggingIn, setLoggingIn] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    // Pull server-side mirror first. Strategy:
    //   - Missing locally     → restore from server
    //   - Server has MORE content (sub-avatars, approved gates) than local
    //     (empty shell case)  → restore from server
    //   - Otherwise           → keep local (user's in-progress changes win)
    // Always restore gate outputs the user doesn't have locally, since a
    // project can exist locally as an empty shell with no gateOutputs.
    try {
      const boot = await fetchBootstrap();
      if (boot) {
        const local = await getAllProjects();
        const localById = new Map(local.map((p) => [p.id, p]));

        const contentScore = (p: unknown): number => {
          if (!p || typeof p !== 'object') return 0;
          const proj = p as Record<string, unknown>;
          const avatarRun = proj.avatarRunResult as { sub_avatars?: unknown[] } | undefined;
          const subCount = avatarRun?.sub_avatars?.length ?? 0;
          const statuses = (proj.gateStatuses ?? {}) as Record<string, string>;
          const approved = Object.values(statuses).filter((s) => s === 'approved').length;
          return subCount * 10 + approved * 5;
        };

        for (const p of boot.projects) {
          if (!p || typeof p !== 'object' || !('id' in p)) continue;
          const id = String((p as unknown as Record<string, unknown>).id);
          const localP = localById.get(id);
          if (!localP || contentScore(p) > contentScore(localP)) {
            await restoreProject(p as Project);
          }
        }

        for (const g of boot.gateOutputs) {
          if (g && typeof g === 'object' && 'gateId' in g && 'projectId' in g) {
            await restoreGateOutput(g);
          }
        }
      }
    } catch (err) {
      console.warn('[dashboard] bootstrap restore skipped:', err);
    }
    const all = await getAllProjects();
    setProjects(all);
    setLoading(false);
  }, []);

  // On mount: ask the server whether we have a valid session cookie.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
        if (!res.ok) {
          if (!cancelled) { setSessionChecked(true); setLoading(false); }
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (data.authenticated && data.user?.name) {
          setAppUser(data.user.name);
          setIsAdminSession(data.user.role === 'admin');
          // Keep localStorage.app-user in sync ONLY as a display hint
          // for legacy pages (contribute, curate, tools). The server
          // is the authoritative identity source via the session cookie.
          try { localStorage.setItem('app-user', data.user.name); } catch {}
          await loadProjects();
        } else {
          try { localStorage.removeItem('app-auth'); } catch {}
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      } finally {
        if (!cancelled) setSessionChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [loadProjects]);

  // --- Presence heartbeat (every 30s when logged in) ---
  useEffect(() => {
    if (!appUser) return;
    let cancelled = false;

    async function heartbeat() {
      try {
        const res = await fetch('/api/presence', {
          method: 'POST',
          credentials: 'same-origin',
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setOnlineCount(data.online ?? 0);
          setOnlineUsers(data.users ?? []);
        }
      } catch { /* non-fatal */ }
    }

    heartbeat(); // immediate first ping
    const interval = setInterval(heartbeat, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [appUser]);

  // Step 1: user enters password. We don't validate it yet — we fetch
  // the user list from the server (which is gated behind the same
  // APP_PASSWORD server-side) and move to the picker. The real password
  // check happens on picker submit via /api/auth/login.
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setAuthError(null);
    setLoggingIn(true);
    try {
      // Fetch the user list. This endpoint does NOT require a session,
      // but the login endpoint will reject if the password is wrong.
      const res = await fetch('/api/auth/users', { credentials: 'same-origin' });
      if (!res.ok) {
        setAuthError('Could not load user list — is the server up?');
        return;
      }
      const data = await res.json();
      if (!data.ok || !Array.isArray(data.users) || data.users.length === 0) {
        setAuthError('No users available — contact admin');
        return;
      }
      setPickerUsers(data.users);
      setPendingPassword(password);
      setPassword('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoggingIn(false);
    }
  }

  // Step 2: user picks their name. We POST password + user to /api/auth/login.
  // On success the server sets an HttpOnly cookie and we proceed.
  async function handlePickUser(u: PickerUser) {
    if (!pendingPassword) return;
    setLoggingIn(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password: pendingPassword, user: u.name }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        // Wrong password / disabled user — bounce back to step 1
        setAuthError(data.message || 'Login failed');
        setPendingPassword(null);
        setPickerUsers([]);
        return;
      }
      setAppUser(data.user.name);
      setIsAdminSession(data.user.role === 'admin');
      // Display hint for legacy pages — server cookie is authoritative
      try { localStorage.setItem('app-user', data.user.name); } catch {}
      setPendingPassword(null);
      setPickerUsers([]);
      await loadProjects();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Network error');
      setPendingPassword(null);
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch {
      // non-fatal; cookie gets cleared either way
    }
    setAppUser(null);
    setIsAdminSession(false);
    setProjects([]);
    try {
      localStorage.removeItem('app-user');
      localStorage.removeItem('app-auth'); // legacy bypass key — wipe on every logout
    } catch {}
  }

  // Still checking /api/auth/me on mount — show nothing to avoid flash.
  if (!sessionChecked) {
    return <div className="min-h-screen bg-bg-primary" />;
  }

  // Step 1 — Password entry
  if (!appUser && !pendingPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="bg-bg-card border border-border rounded-xl p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-accent-orange">Pawen Command Center</h1>
            <p className="text-text-secondary text-sm mt-1">Private beta</p>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setAuthError(null); }}
              placeholder="Password"
              className="w-full px-4 py-3 bg-bg-input border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-orange"
              autoFocus
            />
            {authError && <p className="text-error text-sm">{authError}</p>}
            <button
              type="submit"
              disabled={loggingIn || !password}
              className="w-full py-3 bg-accent-orange text-white font-semibold rounded-lg hover:bg-accent-orange-hover disabled:opacity-50"
            >
              {loggingIn ? 'Loading…' : 'Next'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Step 2 — User picker
  if (!appUser && pendingPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4">
        <div className="bg-bg-card border border-border rounded-xl p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-accent-orange">Who are you?</h1>
            <p className="text-text-secondary text-sm mt-1">
              Pick your tag — the server will verify the password when you click.
            </p>
          </div>
          {authError && <p className="text-error text-sm text-center mb-3">{authError}</p>}
          <div className="grid grid-cols-3 gap-2">
            {pickerUsers.map((u) => (
              <button
                key={u.name}
                onClick={() => handlePickUser(u)}
                disabled={loggingIn}
                className={`py-2.5 rounded-lg text-sm font-medium border text-text-primary hover:border-accent-orange disabled:opacity-50 ${
                  u.role === 'admin' ? 'border-accent-orange/40' : 'border-border'
                }`}
              >
                {u.name}
                {u.role === 'admin' && <span className="ml-1 text-[9px] text-accent-orange">★</span>}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setPendingPassword(null); setPickerUsers([]); setAuthError(null); }}
            className="w-full mt-4 text-text-muted text-xs hover:text-text-secondary"
          >
            ← back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="border-b border-border bg-bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-accent-orange">Pawen Command Center</h1>
            <p className="text-text-muted text-xs">Multi-agent AI pipeline — Any product, any language, any niche</p>
          </div>
          <div className="flex items-center gap-3">
            {onlineCount > 0 && (
              <span
                className="px-3 py-1 text-xs rounded-md border border-green-500/40 bg-green-500/10 text-green-400 cursor-default"
                title={onlineUsers.join(', ')}
              >
                <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1.5 animate-pulse" />
                {onlineCount} online
              </span>
            )}
            {appUser && (
              <span className={`px-3 py-1 text-xs rounded-md border ${
                isAdminSession
                  ? 'bg-accent-orange/10 border-accent-orange/40 text-accent-orange'
                  : 'bg-bg-primary border-border text-text-secondary'
              }`}>
                {appUser}{isAdminSession && ' ★'}
              </span>
            )}
            <Link href="/agents" className="px-4 py-2 border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-text-muted text-sm">
              Agent Team
            </Link>
            <Link href="/tools" className="px-4 py-2 border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-text-muted text-sm">
              Tools
            </Link>
            <Link href="/contribute" className="px-4 py-2 border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-text-muted text-sm">
              Contribute
            </Link>
            {isAdminSession && (
              <Link href="/admin" className="px-4 py-2 border border-accent-orange/40 bg-accent-orange/10 rounded-lg text-accent-orange hover:bg-accent-orange/20 text-sm">
                God Panel
              </Link>
            )}
            <Link href="/swipe-vault" className="px-4 py-2 border border-accent-teal/40 rounded-lg text-accent-teal hover:bg-accent-teal/10 text-sm">
              🗃️ Swipe Vault
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
            <button
              onClick={handleLogout}
              className="px-3 py-2 border border-border rounded-lg text-text-muted hover:text-error hover:border-error/50 text-sm"
              title="Log out"
            >
              Logout
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
          <p className="text-text-muted text-xs mt-1 truncate">
            {project.coreAvatarInput?.niche ||
              project.coreAvatarInput?.surface_desire ||
              project.productUrl ||
              'No avatar yet'}
          </p>
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
  const [langIdx, setLangIdx] = useState(0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const lang = LANGUAGES[langIdx];
    const project = createProject(name.trim(), lang.code, lang.market);
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
          <p className="text-xs text-text-muted">
            The pipeline starts from a <span className="text-text-primary font-medium">Core Avatar</span> in Gate 1 —
            no need to fill product info here. You&apos;ll define surface desire, niche, product, language and market on the next screen.
          </p>
          <div>
            <label className="block text-text-secondary text-sm mb-1.5">Project Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Sleep Restoration — France"
              className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-orange text-sm"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="block text-text-secondary text-sm mb-1.5">Default Target Language & Market</label>
            <select
              value={langIdx}
              onChange={(e) => setLangIdx(Number(e.target.value))}
              className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent-orange text-sm"
            >
              {LANGUAGES.map((lang, i) => (
                <option key={lang.code} value={i}>{lang.label} — {lang.market}</option>
              ))}
            </select>
            <p className="text-[11px] text-text-muted mt-1">You can override this in the Gate 1 Core Avatar form.</p>
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
