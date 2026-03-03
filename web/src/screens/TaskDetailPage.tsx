import React from 'react';
import { useParams } from 'react-router-dom';
import {
  apiGet,
  apiPost,
  type AgentRole,
  type TaskDetail,
  type Status,
} from '../lib/api';

const roles: AgentRole[] = ['architect', 'executor', 'qa', 'reviewer'];

function statusBadge(status: Status) {
  if (status === 'running' || status === 'done') return 'badge badgeOk';
  if (status === 'idle') return 'badge badgeNeutral';
  return 'badge badgeWarn';
}

function RoleLog({ role }: { role: AgentRole }) {
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

  return (
    <div className="term" style={{ marginTop: 10, height: 160 }}>
      <div className="termLine" style={{ color: '#a1a1aa' }}>
        {text || '(waiting for tmux log...)'}
      </div>
    </div>
  );
}

export function TaskDetailPage() {
  const { taskId } = useParams();
  const [detail, setDetail] = React.useState<TaskDetail | null>(null);
  const [cmd, setCmd] = React.useState('');
  const [err, setErr] = React.useState<string | null>(null);

  async function refresh() {
    if (!taskId) return;
    try {
      setErr(null);
      setDetail(await apiGet<TaskDetail>(`/api/tasks/${encodeURIComponent(taskId)}`));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  React.useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function send(role?: AgentRole) {
    if (!taskId) return;
    const text = cmd.trim();
    if (!text) return;
    setCmd('');
    await apiPost(`/api/tasks/${encodeURIComponent(taskId)}/command`, { role, text });
    await refresh();
  }

  async function runStage(stage: string) {
    if (!taskId) return;
    await apiPost(`/api/tasks/${encodeURIComponent(taskId)}/stage`, { stage });
    await refresh();
  }

  return (
    <div className="container" style={{ maxWidth: 1440 }}>
      <div className="card" style={{ background: '#1E2026', borderRadius: 6, border: '1px solid #2A2B30' }}>
        <div style={{ fontSize: 26, fontWeight: 900 }}>TASK_DETAIL // AGENT_CONTROL_CENTER</div>
        <div className="row mono" style={{ marginTop: 10, color: '#71717A', fontSize: 12 }}>
          <span className={statusBadge(detail?.status ?? 'idle')}>
            STATUS: {(detail?.status ?? 'idle').toUpperCase()}
          </span>
          <span>TASK_ID: {detail?.id ?? taskId}</span>
          <span>UPDATED: {detail?.updatedAtUtc ?? '-'}</span>
        </div>
        {err ? <div style={{ marginTop: 10, color: '#ff6b35' }}>{err}</div> : null}
      </div>

      {detail ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, marginTop: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="grid2">
              {roles.map((r) => (
                <div
                  key={r}
                  style={{ background: '#1E2026', borderRadius: 6, border: '1px solid #2A2B30', padding: 12 }}
                >
                  <div className="spread">
                    <div style={{ fontWeight: 900, textTransform: 'lowercase' }}>{r}</div>
                    <span className={statusBadge(detail.agents[r].status)}>{detail.agents[r].status}</span>
                  </div>
                  <div className="mono" style={{ color: '#71717A', fontSize: 11, marginTop: 4 }}>
                    ANIMAL: {detail.agents[r].animal}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.35 }}>{detail.agents[r].line}</div>

                  {/* live tmux log */}
                  <RoleLog role={r} />
                </div>
              ))}
            </div>

            <div style={{ background: '#1E2026', borderRadius: 6, border: '1px solid #2A2B30', padding: 12 }}>
              <div className="mono" style={{ color: '#71717A', fontSize: 11, fontWeight: 800 }}>
                // SUMMARY
              </div>
              <div style={{ marginTop: 8, fontSize: 15, lineHeight: 1.4 }}>{detail.summary}</div>
            </div>

            <div style={{ background: '#1E2026', borderRadius: 6, border: '1px solid #2A2B30', padding: 12 }}>
              <div className="mono" style={{ color: '#71717A', fontSize: 11, fontWeight: 800 }}>
                // LOG_TERMINAL_VIEWER
              </div>
              <div className="term" style={{ marginTop: 8 }}>
                {detail.timeline.map((e, idx) => (
                  <div
                    key={idx}
                    className="termLine"
                    style={{
                      color:
                        e.level === 'ok'
                          ? '#22c55e'
                          : e.level === 'warn'
                            ? '#f59e0b'
                            : '#a1a1aa',
                    }}
                  >
                    [{e.t}] {e.msg}
                  </div>
                ))}
              </div>

              <div className="row" style={{ marginTop: 10 }}>
                <input
                  className="mono"
                  value={cmd}
                  onChange={(ev) => setCmd(ev.target.value)}
                  placeholder="cmd> ..."
                  style={{
                    flex: 1,
                    background: '#232529',
                    border: '1px solid #3F3F46',
                    borderRadius: 6,
                    color: '#f4f4f5',
                    padding: '10px 12px',
                    outline: 'none',
                  }}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter') void send();
                  }}
                />
                <button className="btn btnSuccess" onClick={() => void send()}>
                  SEND
                </button>
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn btnOutlineWarn" onClick={() => alert('TODO: stop')}>STOP</button>
                <button className="btn" style={{ borderColor: '#22c55e', color: '#22c55e' }} onClick={() => void refresh()}>
                  RETRY
                </button>
              </div>
            </div>

            <div style={{ background: '#1E2026', borderRadius: 6, border: '1px solid #2A2B30', padding: 12 }}>
              <div className="mono" style={{ color: '#71717A', fontSize: 11, fontWeight: 800 }}>
                // STAGE_CONTROLS
              </div>
              <div
                className="row mono"
                style={{ marginTop: 8, gap: 14, color: '#22c55e', fontWeight: 800, fontSize: 12, flexWrap: 'wrap' }}
              >
                {([
                  ['Run Plan', 'Plan'],
                  ['Run Exec', 'Exec'],
                  ['Run Verify', 'Verify'],
                  ['Run Review', 'Review'],
                  ['Run Fix Loop', 'Fix Loop'],
                ] as const).map(([label, stage]) => (
                  <button
                    key={stage}
                    className="btn"
                    style={{ borderColor: '#22c55e', color: '#22c55e', background: 'transparent' }}
                    onClick={() => void runStage(stage)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#1E2026', borderRadius: 6, border: '1px solid #2A2B30', padding: 12 }}>
              <div className="mono" style={{ color: '#71717A', fontSize: 11, fontWeight: 800 }}>
                // TOAST_PATTERN
              </div>
              <div style={{ marginTop: 10, background: '#232529', border: '1px solid #22c55e', borderRadius: 6, padding: 10 }}>
                <div className="mono" style={{ color: '#22c55e', fontSize: 12, fontWeight: 800 }}>
                  DONE: Verify stage completed. Artifacts updated.
                </div>
              </div>
              <div style={{ marginTop: 10, background: '#232529', border: '1px solid #f59e0b', borderRadius: 6, padding: 10 }}>
                <div className="mono" style={{ color: '#f59e0b', fontSize: 12, fontWeight: 800 }}>
                  ERROR: Run Exec blocked by migration lock.
                </div>
              </div>
            </div>

            <div style={{ background: '#1E2026', borderRadius: 6, border: '1px solid #2A2B30', padding: 12 }}>
              <div className="mono" style={{ color: '#71717A', fontSize: 11, fontWeight: 800 }}>
                // STATUS_BADGES
              </div>
              <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                {(['Idle', 'Running', 'Done', 'Error', 'Timeout', 'Blocked'] as const).map((x) => (
                  <span key={x} className={statusBadge(x.toLowerCase() as Status)}>
                    {x}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ background: '#1E2026', borderRadius: 6, border: '1px solid #f59e0b', padding: 12 }}>
              <div className="mono" style={{ color: '#f59e0b', fontSize: 11, fontWeight: 900 }}>
                // FAILURE_TIMEOUT
              </div>
              <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.35 }}>
                CAUSE: Executor exceeded 300s timeout waiting for migration lock on db-primary.
              </div>
              <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.35 }}>
                NEXT ACTION: Run Fix Loop with lock cleanup precheck, then retry verify stage.
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn btnOutlineWarn">OPEN LOGS</button>
                <button className="btn btnSuccess">RUN FIX LOOP</button>
              </div>
            </div>

            <div style={{ background: '#1E2026', borderRadius: 6, border: '1px solid #2A2B30', padding: 12 }}>
              <div className="mono" style={{ color: '#71717A', fontSize: 11, fontWeight: 800 }}>
                // QUICK COMMANDS
              </div>
              <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                {roles.map((r) => (
                  <button
                    key={r}
                    className="btn"
                    onClick={() => void send(r)}
                    title={`Send command to ${r}`}
                  >
                    SEND → {r}
                  </button>
                ))}
              </div>
              <div className="mono" style={{ marginTop: 10, color: '#71717A', fontSize: 10 }}>
                Tip: prefix cmd with "@architect" etc if you want a manual convention.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mono" style={{ marginTop: 16, color: '#777' }}>loading…</div>
      )}
    </div>
  );
}
