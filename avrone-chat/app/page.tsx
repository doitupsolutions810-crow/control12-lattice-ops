'use client';

import { FormEvent, useEffect, useState } from 'react';

type ChatMsg = { role: 'user' | 'assistant'; content: string };

type Cockpit = {
  platform?: { ok?: boolean };
  security?: { severity?: string; dualCa?: boolean; mtls?: boolean; findings?: string[] };
  belief?: { meanBelief?: number | null; nodes?: { id: string; belief: number }[] };
};

export default function Page() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('ready');
  const [cockpit, setCockpit] = useState<Cockpit | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch('/api/cockpit')
        .then(r => r.json())
        .then(d => {
          if (!cancelled) setCockpit(d);
        })
        .catch(() => {
          if (!cancelled) setCockpit(null);
        });
    };
    load();
    const t = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    const next: ChatMsg[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    setStatus('wiring lattice…');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          belief: 0.55
        })
      });

      const offline = res.headers.get('x-lattice-offline') === '1';
      setStatus(offline ? 'lattice offline · model only' : 'lattice connected · streaming');

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        setMessages(m => [
          ...m,
          { role: 'assistant', content: `Error: ${(err as { error?: string }).error || res.statusText}` }
        ]);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setMessages(m => [...m, { role: 'assistant', content: '(empty stream)' }]);
        return;
      }

      const decoder = new TextDecoder();
      let assistant = '';
      setMessages(m => [...m, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content || '';
            if (delta) {
              assistant += delta;
              setMessages(m => {
                const copy = [...m];
                copy[copy.length - 1] = { role: 'assistant', content: assistant };
                return copy;
              });
            }
          } catch {
            /* ignore partial SSE */
          }
        }
      }
      setStatus(offline ? 'done · lattice was offline' : 'done');
    } catch (err) {
      setMessages(m => [
        ...m,
        { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : String(err)}` }
      ]);
      setStatus('error');
    } finally {
      setBusy(false);
    }
  }

  const sev = cockpit?.security?.severity || '—';
  const mean =
    cockpit?.belief?.meanBelief != null ? Number(cockpit.belief.meanBelief).toFixed(3) : '—';

  return (
    <main>
      <header>
        <h1>Avrone Due’Krey</h1>
        <p>Lattice-wired chat · CONTROL12 living intermediate</p>
        <div className="status" style={{ marginTop: '0.75rem' }}>
          cockpit · platform={cockpit?.platform?.ok ? 'up' : 'down'} · severity={sev}
          {cockpit?.security?.mtls ? ' · mTLS' : ''}
          {cockpit?.security?.dualCa ? ' · dual-CA' : ''} · meanBelief={mean}
        </div>
      </header>

      <div className="messages">
        {messages.length === 0 && (
          <div className="bubble assistant">
            Speak into the field. Spectrum and belief shape tone when the platform is reachable.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.content}
          </div>
        ))}
      </div>

      <form onSubmit={onSubmit}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Message Avrone…"
          disabled={busy}
          autoFocus
        />
        <button type="submit" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
      <div className="status">{status}</div>
    </main>
  );
}
