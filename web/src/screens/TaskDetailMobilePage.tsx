import React from 'react';
import { useParams } from 'react-router-dom';
import { apiPost, type AgentRole } from '../lib/api';

const roles: AgentRole[] = ['architect', 'executor', 'qa', 'reviewer'];

function Pill({ active, children, onClick }: { active?: boolean; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      className="btn"
      onClick={onClick}
      style={{
        padding: '8px 10px',
        borderRadius: 12,
        background: active ? '#1E2026' : 'transparent',
        borderColor: active ? 'var(--acc-accent)' : 'var(--acc-stroke)',
        color: active ? 'var(--acc-text)' : '#a1a1aa',
      }}
    >
      {children}
    </button>
  );
}

function useRoleLogText(role: AgentRole) {
  const [text, setText] = React.useState<string>('');

  React.useEffect(() => {
    const wsUrl = `${location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/ws`;
    const ws = new WebSocket(wsUrl);
    ws.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as { type: string; role?: string; text?: string };
        if (msg.type === 'role_log' && msg.role === role && typeof msg.text === 'string') {
          setText(msg.text);
        }
      } catch {
        // ignore
      }
    });
    return () => ws.close();
  }, [role]);

  return text;
}

export function TaskDetailMobilePage() {
  const { taskId } = useParams();
  const [role, setRole] = React.useState<AgentRole>('architect');
  const [cmd, setCmd] = React.useState<string>('');
  const [toast, setToast] = React.useState<string | null>(null);
  const logText = useRoleLogText(role);

  function show(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }

  async function refresh() {
    // TODO: load task meta/status for mobile view
  }

  async function send() {
    if (!taskId) return;
    const text = cmd.trim();
    if (!text) return;
    setCmd('');
    await apiPost(`/api/tasks/${encodeURIComponent(taskId)}/command`, { role, text });
    show(`sent → ${role}`);
  }

  async function runStage(stage: string) {
    if (!taskId) return;
    await apiPost(`/api/tasks/${encodeURIComponent(taskId)}/stage`, { stage });
    show(`stage → ${stage}`);
  }

  return (
    <div className="container" style={{ maxWidth: 430, padding: 16 }}>
      <div
        className="card"
        style={{
          background: 'var(--acc-m-surface)',
          border: `1px solid rgba(42,43,48,0.9)`,
          borderRadius: 16,
        }}
      >
        <div className="spread">
          <div
            className="mono"
            style={{ fontWeight: 700, letterSpacing: 0.4, fontSize: 18, color: 'var(--acc-m-text)' }}
          >
            Task Detail
          </div>
          <button className="btn btnOutline" style={{ borderRadius: 999 }} onClick={() => show('TODO: theme')}>
            Light
          </button>
        </div>

        <div
          style={{
            marginTop: 10,
            background: 'var(--acc-m-panel)',
            border: `1px solid rgba(42,43,48,0.9)`,
            borderRadius: 10,
            padding: 10,
          }}
        >
          <div className="mono" style={{ color: 'var(--acc-m-muted2)', fontSize: 11 }}>
            repo: /workspace/agent-control-center
          </div>
          <div className="mono" style={{ color: 'var(--acc-m-muted)', fontSize: 11, marginTop: 6 }}>
            goal: plan→exec→verify→review with fix loop
          </div>
        </div>

        {toast ? (
          <div
            style={{
              marginTop: 10,
              background: 'var(--acc-card2)',
              border: '1px solid var(--acc-warn)',
              borderRadius: 10,
              padding: 10,
            }}
          >
            <div className="mono" style={{ color: 'var(--acc-warn)', fontWeight: 800, fontSize: 12 }}>
              {toast}
            </div>
          </div>
        ) : null}

        <div className="row" style={{ marginTop: 12, flexWrap: 'wrap', gap: 6 }}>
          {roles.map((r) => (
            <Pill key={r} active={role === r} onClick={() => setRole(r)}>
              {r === 'architect' ? 'architect 🦉' : r === 'executor' ? 'executor 🐺' : r === 'qa' ? 'qa 🦦' : 'reviewer 🦊'}
            </Pill>
          ))}
        </div>

        <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
          <span className="badge badgeWarn" style={{ borderColor: '#FF8B96', color: '#FF8B96' }}>
            Timeout
          </span>
          <span className="mono" style={{ color: '#D7E3FF', fontSize: 11 }}>
            Last: Verify timeout at 14:07
          </span>
        </div>

        <div
          style={{
            marginTop: 10,
            background: 'var(--acc-m-fail)',
            border: '1px solid rgba(42,43,48,0.9)',
            borderRadius: 10,
            padding: 10,
          }}
        >
          <div className="mono" style={{ color: 'var(--acc-m-dangerText)', fontSize: 11 }}>
            원인 요약: qa test command exited 124 (timeout)
          </div>
          <div className="mono" style={{ color: '#FFD5DA', fontSize: 11, marginTop: 6 }}>
            다음 액션: narrow scope + retry verify
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div
            className="term"
            style={{ height: 240, background: 'var(--acc-m-log)', borderRadius: 10, borderColor: 'rgba(42,43,48,0.9)' }}
          >
            <div className="termLine" style={{ color: 'var(--acc-m-successText)', fontSize: 11 }}>
              {logText || '(waiting for tmux log...)'}
            </div>
          </div>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <input
            className="mono"
            value={cmd}
            onChange={(ev) => setCmd(ev.target.value)}
            placeholder="command / prompt…"
            style={{
              flex: 1,
              background: '#0f1115',
              border: `1px solid var(--acc-stroke)`,
              borderRadius: 12,
              color: 'var(--acc-text)',
              padding: '10px 12px',
              outline: 'none',
            }}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') void send();
            }}
          />
          <button className="btn btnSuccess" onClick={() => void send()}>
            Send
          </button>
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" style={{ flex: 1, borderColor: '#7f1d1d', color: '#fecaca', background: 'rgba(127,29,29,0.15)' }} onClick={() => show('TODO: stop')}>
            Stop
          </button>
          <button className="btn btnOutline" style={{ flex: 1 }} onClick={() => void refresh()}>
            Retry
          </button>
        </div>

        <div style={{ marginTop: 14, background: '#111318', border: `1px solid var(--acc-stroke)`, borderRadius: 16, padding: 12 }}>
          <div className="mono" style={{ color: '#a1a1aa', fontSize: 11, fontWeight: 800 }}>
            Stage Controls
          </div>
          <div className="mono" style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 11, color: 'var(--acc-accent)' }}>
            {([
              ['Run Plan', 'Plan'],
              ['Run Exec', 'Exec'],
              ['Run Verify', 'Verify'],
              ['Run Review', 'Review'],
              ['Run Fix Loop', 'Fix Loop'],
            ] as const).map(([label, stage]) => (
              <button key={stage} className="btn btnOutlineSuccess" onClick={() => void runStage(stage)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 14, background: '#111318', border: `1px solid var(--acc-stroke)`, borderRadius: 16, padding: 12 }}>
          <div className="mono" style={{ color: '#a1a1aa', fontSize: 11, fontWeight: 800 }}>
            Artifacts
          </div>
          <div className="mono" style={{ marginTop: 8, color: '#a1a1aa', fontSize: 12 }}>
            (coming soon)
          </div>
        </div>

        <div style={{ marginTop: 14, background: '#111318', border: `1px solid var(--acc-stroke)`, borderRadius: 16, padding: 12 }}>
          <div className="mono" style={{ color: '#a1a1aa', fontSize: 11, fontWeight: 800 }}>
            Policies
          </div>
          <div className="mono" style={{ marginTop: 8, color: '#a1a1aa', fontSize: 12 }}>
            (coming soon)
          </div>
        </div>
      </div>
    </div>
  );
}
