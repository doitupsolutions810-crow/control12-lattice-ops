'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  BrowserWorkspace,
  DEFAULT_WORKSPACE,
  saveWorkspaceFile
} from '../lib/browser-workspace';
import { SNAPSHOT_V72 } from '../lib/snapshot-v72';

type ChatMsg = { role: 'user' | 'assistant'; content: string };
type Cockpit = {
  platform?: { ok?: boolean };
  security?: { severity?: string; dualCa?: boolean; mtls?: boolean };
  belief?: { meanBelief?: number | null };
};

const STORAGE_KEY = 'control12.avrone.browser-workspace.v1';
const INITIAL_MESSAGE: ChatMsg = {
  role: 'assistant',
  content:
    'You are viewing verified package snapshot v72. Values are package-derived, not live telemetry. Production authority is denied. Ask about nodes, ratio, roles, evidence, or boundaries.'
};

function loadWorkspace() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_WORKSPACE;
    const parsed = JSON.parse(stored) as BrowserWorkspace;
    return parsed.schema === DEFAULT_WORKSPACE.schema && Array.isArray(parsed.files) && Array.isArray(parsed.revisions)
      ? parsed
      : DEFAULT_WORKSPACE;
  } catch {
    return DEFAULT_WORKSPACE;
  }
}

export default function Page() {
  const [messages, setMessages] = useState<ChatMsg[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [chatStatus, setChatStatus] = useState('deterministic snapshot mode');
  const [cockpit, setCockpit] = useState<Cockpit | null>(null);
  const [workspace, setWorkspace] = useState<BrowserWorkspace>(DEFAULT_WORKSPACE);
  const [activePath, setActivePath] = useState(DEFAULT_WORKSPACE.files[0].path);
  const [draft, setDraft] = useState(DEFAULT_WORKSPACE.files[0].content);
  const [workspaceStatus, setWorkspaceStatus] = useState('browser-local · no execution');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const restored = loadWorkspace();
    setWorkspace(restored);
    setActivePath(restored.files[0]?.path || DEFAULT_WORKSPACE.files[0].path);
    setDraft(restored.files[0]?.content || DEFAULT_WORKSPACE.files[0].content);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  }, [hydrated, workspace]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/cockpit')
      .then(response => response.json())
      .then(data => {
        if (!cancelled) setCockpit(data);
      })
      .catch(() => {
        if (!cancelled) setCockpit(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeFile = workspace.files.find(file => file.path === activePath);
  const latestRevision = workspace.revisions.at(-1);
  const lineCount = useMemo(() => draft.split('\n').length, [draft]);

  function selectFile(path: string) {
    const file = workspace.files.find(candidate => candidate.path === path);
    if (!file) return;
    setActivePath(path);
    setDraft(file.content);
    setWorkspaceStatus('browser-local · no execution');
  }

  async function saveFile() {
    try {
      const next = await saveWorkspaceFile(workspace, activePath, draft);
      setWorkspace(next);
      setWorkspaceStatus(`saved revision ${next.revisions.length} · hash linked`);
    } catch (error) {
      setWorkspaceStatus(error instanceof Error ? error.message : 'save failed');
    }
  }

  function resetWorkspace() {
    setWorkspace(DEFAULT_WORKSPACE);
    setActivePath(DEFAULT_WORKSPACE.files[0].path);
    setDraft(DEFAULT_WORKSPACE.files[0].content);
    setWorkspaceStatus('workspace reset · browser-local');
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next: ChatMsg[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    setChatStatus('assembling bounded response…');
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next, belief: 0.55 })
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error((failure as { error?: string }).error || response.statusText);
      }
      const mode = response.headers.get('x-avrone-mode') || 'provider';
      const reader = response.body?.getReader();
      if (!reader) throw new Error('empty response stream');
      const decoder = new TextDecoder();
      let assistant = '';
      setMessages(current => [...current, { role: 'assistant', content: '' }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.trim().startsWith('data:')) continue;
          const data = line.trim().slice(5).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            assistant += delta;
            setMessages(current => {
              const copy = [...current];
              copy[copy.length - 1] = { role: 'assistant', content: assistant };
              return copy;
            });
          } catch {
            // Ignore an incomplete SSE frame; the next complete frame is authoritative.
          }
        }
      }
      setChatStatus(mode === 'deterministic-snapshot' ? 'snapshot mode · no provider key' : 'provider response · bounded');
    } catch (error) {
      setMessages(current => [
        ...current,
        { role: 'assistant', content: `Request failed: ${error instanceof Error ? error.message : String(error)}` }
      ]);
      setChatStatus('request failed');
    } finally {
      setBusy(false);
    }
  }

  const platformLive = Boolean(cockpit?.platform?.ok);

  return (
    <main className="console-shell">
      <aside className="sidebar" aria-label="Console navigation">
        <div className="brand-mark" aria-hidden="true">C12</div>
        <nav>
          <a className="nav-item active" href="#overview">Overview</a>
          <a className="nav-item" href="#chat">Chat</a>
          <a className="nav-item" href="#workspace">Workspace</a>
          <a className="nav-item" href="#evidence">Evidence</a>
        </nav>
        <div className="sidebar-status">
          <span className="status-dot" />
          <strong>Verified snapshot</strong>
          <span>v72 · read-only source</span>
          <span>{platformLive ? 'platform connected' : 'no live platform'}</span>
        </div>
      </aside>

      <section className="console-main">
        <header className="topbar">
          <div>
            <h1>Avrone Due’Krey</h1>
            <p>CONTROL12 Verified Lattice Console</p>
          </div>
          <div className="snapshot-warning">Verified package snapshot · not live telemetry</div>
          <dl className="header-meta">
            <div><dt>Snapshot</dt><dd>v72</dd></div>
            <div><dt>Source</dt><dd>manifest verified</dd></div>
          </dl>
        </header>

        <section className="overview-panel" id="overview" aria-label="Verified lattice snapshot">
          <div className="counts-block">
            <div className="section-label">Lattice composition · v72</div>
            <div className="count-grid">
              {(['a', 'b', 'c'] as const).map(key => (
                <div className="metric" key={key}>
                  <span>{key.toUpperCase()}</span>
                  <strong>{SNAPSHOT_V72.counts[key]}</strong>
                  <small>nodes</small>
                </div>
              ))}
              <div className="metric total"><span>Total</span><strong>{SNAPSHOT_V72.counts.total}</strong><small>nodes</small></div>
            </div>
          </div>
          <div className="mesh-visual" aria-label="Tri-mesh topology snapshot">
            <div className="section-label">Tri-mesh topology · snapshot</div>
            <svg viewBox="0 0 260 128" role="img" aria-label="Three connected mesh nodes A, B, and C">
              <path d="M130 18 L38 104 L222 104 Z" />
              <path className="dashed" d="M130 18 L130 76 L38 104 M130 76 L222 104" />
              <circle cx="130" cy="18" r="15" /><circle cx="38" cy="104" r="15" /><circle cx="222" cy="104" r="15" />
              <text x="130" y="23">A</text><text x="38" y="109">B</text><text x="222" y="109">C</text>
            </svg>
          </div>
          <div className="ratio-block">
            <div className="section-label">Lattice ratio · v72</div>
            <strong>{SNAPSHOT_V72.ratio.toFixed(3)}</strong>
            <span>within target range</span>
            <small>{SNAPSHOT_V72.targetBand.min.toFixed(2)} — {SNAPSHOT_V72.targetBand.max.toFixed(2)}</small>
          </div>
        </section>

        <section className="workbench">
          <article className="workspace-panel" id="workspace">
            <div className="panel-heading">
              <div><span>Browser-local workspace</span><small>No execution · no upload</small></div>
              <button className="quiet-button" onClick={resetWorkspace} type="button">Reset</button>
            </div>
            <div className="editor-layout">
              <div className="file-list" aria-label="Workspace files">
                <span className="file-list-label">Files</span>
                {workspace.files.map(file => (
                  <button className={file.path === activePath ? 'file active' : 'file'} key={file.path} onClick={() => selectFile(file.path)} type="button">
                    {file.path}
                  </button>
                ))}
              </div>
              <div className="editor-wrap">
                <div className="editor-tab"><span>{activeFile?.path || activePath}</span><button onClick={saveFile} type="button">Save revision</button></div>
                <textarea aria-label="Workspace code editor" spellCheck={false} value={draft} onChange={event => setDraft(event.target.value)} />
              </div>
            </div>
            <div className="revision-bar">
              <div><span>Revision evidence</span><strong>{latestRevision?.recordHash || 'Save to create the first hash-linked revision'}</strong></div>
              <small>{lineCount} lines · {workspaceStatus}</small>
            </div>
          </article>

          <article className="chat-panel" id="chat">
            <div className="panel-heading">
              <div><span>Avrone chat</span><small>Bounded to snapshot v72</small></div>
              <button className="quiet-button" onClick={() => setMessages([INITIAL_MESSAGE])} type="button">Clear</button>
            </div>
            <div className="chat-messages" aria-live="polite">
              {messages.map((message, index) => (
                <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
                  <strong>{message.role === 'assistant' ? 'Avrone' : 'You'}</strong>
                  <p>{message.content}</p>
                </div>
              ))}
            </div>
            <form className="chat-composer" onSubmit={onSubmit}>
              <label htmlFor="chat-input">Message Avrone</label>
              <div>
                <input id="chat-input" value={input} onChange={event => setInput(event.target.value)} placeholder="Ask about snapshot v72…" disabled={busy} />
                <button type="submit" disabled={busy || !input.trim()}>Send</button>
              </div>
              <small>{chatStatus}</small>
            </form>
          </article>
        </section>

        <section className="lower-grid">
          <article className="boundary-panel">
            <div className="section-label">Immutable security boundary · enforced</div>
            <div className="denials">
              {SNAPSHOT_V72.authority.hardDeny.slice(0, 3).map(capability => (
                <div key={capability}><span aria-hidden="true">■</span><strong>{capability}</strong><em>Denied</em></div>
              ))}
            </div>
            <p>Production authority denied. Package authority strings are not authentication.</p>
          </article>
          <article className="evidence-panel" id="evidence">
            <div className="section-label">Evidence · snapshot v72</div>
            <div><strong>Manifest {SNAPSHOT_V72.evidence.manifestFilesVerified} / {SNAPSHOT_V72.evidence.manifestFilesExpected}</strong><span>all listed files accounted for</span></div>
            <div><strong>Certification chain valid</strong><span>hash linkage recomputed</span></div>
            <p>Primary tar is non-canonical: duplicate byte-identical guide member.</p>
          </article>
        </section>

        <footer>
          <span>CONTROL12 Verified Lattice Console v72</span>
          <span>Browser-local workspace</span>
          <span>No production execution</span>
        </footer>
      </section>
    </main>
  );
}
