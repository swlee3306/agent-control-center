import React from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  apiGet,
  apiPost,
  type AgentRole,
  type TaskDetail,
  type Status,
} from '../lib/api';

const roles: AgentRole[] = ['architect', 'executor', 'qa', 'reviewer'];

const roleEmoji: Record<AgentRole, string> = {
  architect: '🦉',
  executor: '🦊',
  qa: '🦦',
  reviewer: '🦅',
};

function normalizeAnimalLabel(animal: string | undefined, role?: AgentRole) {
  const a = String(animal ?? '').toUpperCase();
  // UI convention update: executor is FOX (not WOLF)
  if (role === 'executor' && (a === 'WOLF' || a === '')) return 'FOX';
  if (a === 'WOLF') return 'FOX';
  return a || '-';
}

function statusBadge(status: Status) {
  if (status === 'running' || status === 'done') return 'badge badgeOk';
  if (status === 'idle') return 'badge badgeNeutral';
  return 'badge badgeWarn';
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileQuery(
  q: string,
  regexMode: boolean,
  caseSensitive: boolean,
): { re: RegExp | null; err: string | null } {
  const query = q.trim();
  if (!query) return { re: null, err: null };

  try {
    const source = regexMode ? query : escapeRegExp(query);
    const flags = `g${caseSensitive ? '' : 'i'}`;
    const re = new RegExp(source, flags);

    // Avoid pathological zero-length matches (e.g. ^, $) breaking split/highlight.
    if (re.test('')) return { re: null, err: 'Regex matches empty string (unsupported)' };

    return { re, err: null };
  } catch (e) {
    return { re: null, err: (e as Error).message };
  }
}

function HighlightedLines({ text, re }: { text: string; re: RegExp | null }) {
  if (!re) return <>{text || '(waiting for tmux log...)'}</>;
  const lines = (text || '').split('\n');
  return (
    <>
      {lines.map((line, i) => {
        const parts: Array<string> = line.split(re);
        const matches = line.match(re) ?? [];
        return (
          <React.Fragment key={i}>
            {parts.map((p, j) => (
              <React.Fragment key={j}>
                {p}
                {j < matches.length ? <span className="mark">{matches[j]}</span> : null}
              </React.Fragment>
            ))}
            {i < lines.length - 1 ? '\n' : null}
          </React.Fragment>
        );
      })}
    </>
  );
}

function RoleLog({ role }: { role: AgentRole }) {
  const [text, setText] = React.useState<string>('');
  const [q, setQ] = React.useState<string>('');
  const [regexMode, setRegexMode] = React.useState<boolean>(false);
  const [caseSensitive, setCaseSensitive] = React.useState<boolean>(false);
  const [autoScroll, setAutoScroll] = React.useState<boolean>(true);
  const [updatedAt, setUpdatedAt] = React.useState<string>('');
  const [expanded, setExpanded] = React.useState<boolean>(false);
  const termRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const wsUrl = `${location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as { type: string; role?: string; text?: string };
        if (msg.type === 'role_log' && msg.role === role && typeof msg.text === 'string') {
          setText(msg.text);
          setUpdatedAt(new Date().toISOString().slice(11, 19));
        }
      } catch {
        // ignore
      }
    });

    return () => ws.close();
  }, [role]);

  const { re, err } = React.useMemo(() => compileQuery(q, regexMode, caseSensitive), [q, regexMode, caseSensitive]);

  const filtered = React.useMemo(() => {
    if (!q.trim()) return text;
    if (err || !re) return '';

    return text
      .split('\n')
      .filter((line) => re.test(line))
      .join('\n');
  }, [err, q, re, text]);

  React.useEffect(() => {
    if (!autoScroll) return;
    const el = termRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [autoScroll, filtered]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(filtered || text);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = filtered || text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div className="row mono" style={{ gap: 8, justifyContent: 'space-between', color: '#71717A', fontSize: 11, flexWrap: 'wrap' }}>
        <div className="row mono" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span>log</span>
          <span style={{ color: '#52525b' }}>|</span>
          <span>updated: {updatedAt || '-'}</span>
          <span style={{ color: '#52525b' }}>|</span>
          <label className="row mono" style={{ gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={regexMode} onChange={(e) => setRegexMode(e.target.checked)} />
            regex
          </label>
          <label className="row mono" style={{ gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} />
            Aa
          </label>
          <label className="row mono" style={{ gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
            auto
          </label>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btnOutline" style={{ padding: '8px 10px' }} onClick={() => void copy()}>
            copy
          </button>
          <button className="btn btnOutline" style={{ padding: '8px 10px' }} onClick={() => setExpanded(true)}>
            expand
          </button>
        </div>
      </div>

      <div className="row" style={{ marginTop: 6, flexWrap: 'wrap' }}>
        <input
          className="mono"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={regexMode ? 'regex search…' : 'search in log…'}
          style={{
            flex: 1,
            background: '#232529',
            border: '1px solid #3F3F46',
            borderRadius: 6,
            color: '#f4f4f5',
            padding: '8px 10px',
            outline: 'none',
            minWidth: 200,
          }}
        />
        {q ? (
          <button className="btn" style={{ borderColor: '#3F3F46', color: '#a1a1aa' }} onClick={() => setQ('')}>
            clear
          </button>
        ) : null}
        {err ? (
          <span className="mono" style={{ color: '#f59e0b', fontSize: 11 }}>
            regex error: {err}
          </span>
        ) : null}
      </div>

      <div ref={termRef} className="term" style={{ marginTop: 8, height: 160 }}>
        <div className="termLine" style={{ color: '#a1a1aa' }}>
          <HighlightedLines text={filtered} re={re} />
        </div>
      </div>

      {expanded ? (
        <div className="modalOverlay" onClick={() => setExpanded(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="spread">
              <div className="mono" style={{ fontWeight: 900 }}>
                {role} // log (expanded)
              </div>
              <button className="btn btnOutlineWarn" onClick={() => setExpanded(false)}>
                close
              </button>
            </div>

            <div className="row mono" style={{ marginTop: 10, gap: 10, flexWrap: 'wrap', color: '#71717A', fontSize: 11 }}>
              <label className="row mono" style={{ gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={regexMode} onChange={(e) => setRegexMode(e.target.checked)} />
                regex
              </label>
              <label className="row mono" style={{ gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} />
                Aa
              </label>
              {err ? <span style={{ color: '#f59e0b' }}>regex error: {err}</span> : <span />}
            </div>

            <div className="row" style={{ marginTop: 6 }}>
              <input
                className="mono"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={regexMode ? 'regex search…' : 'search in log…'}
                style={{
                  flex: 1,
                  background: '#232529',
                  border: '1px solid #3F3F46',
                  borderRadius: 6,
                  color: '#f4f4f5',
                  padding: '8px 10px',
                  outline: 'none',
                }}
              />
              {q ? (
                <button className="btn" style={{ borderColor: '#3F3F46', color: '#a1a1aa' }} onClick={() => setQ('')}>
                  clear
                </button>
              ) : null}
              <button className="btn" style={{ borderColor: '#3F3F46', color: '#a1a1aa' }} onClick={() => void copy()}>
                copy
              </button>
            </div>

            <div className="term" style={{ marginTop: 10, height: '70vh' as const }}>
              <div className="termLine" style={{ color: '#a1a1aa' }}>
                <HighlightedLines text={filtered} re={re} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function TaskDetailPage() {
  const { taskId } = useParams();
  const [detail, setDetail] = React.useState<TaskDetail | null>(null);
  const [cmd, setCmd] = React.useState('');
  const [err, setErr] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{ kind: 'ok' | 'warn'; msg: string } | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

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
    await runBusy(`stage:${stage}`, async () => {
      try {
        await apiPost(`/api/tasks/${encodeURIComponent(taskId)}/stage`, { stage });
        showToast('ok', `Stage sent: ${stage}`);
        await refresh();
      } catch (e) {
        showToast('warn', String((e as Error).message || e));
      }
    });
  }

  function showToast(kind: 'ok' | 'warn', msg: string) {
    setToast({ kind, msg });
    window.setTimeout(() => setToast(null), 2500);
  }

  async function runBusy(key: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  async function syncPaneTitles() {
    try {
      await apiPost('/api/tmux/sync-titles', {});
      showToast('ok', 'Synced pane titles');
    } catch (e) {
      showToast('warn', String((e as Error).message || e));
    }
  }

  return (
    <div className="container" style={{ maxWidth: 1440 }}>
      <div className="card" style={{ background: '#1E2026', borderRadius: 6, border: '1px solid #2A2B30' }}>
        <div className="spread taskHeader" style={{ gap: 12 }}>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
            <div className="taskTitle mono" style={{ fontSize: 26, fontWeight: 900 }}>
              TASK_DETAIL // AGENT_CONTROL_CENTER
            </div>
          </div>
          <div className="taskHeaderActions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              className="btn"
              style={{ borderColor: '#22c55e', color: '#22c55e', background: 'transparent' }}
              onClick={() => void syncPaneTitles()}
            >
              Sync pane titles
            </button>
            <Link className="btn" style={{ borderColor: '#3F3F46', color: '#a1a1aa', background: 'transparent' }} to="/">
              Back to Dashboard
            </Link>
          </div>
        </div>
        {toast ? (
          <div
            style={{
              marginTop: 10,
              background: '#232529',
              border: `1px solid ${toast.kind === 'ok' ? '#22c55e' : '#f59e0b'}`,
              borderRadius: 6,
              padding: 10,
            }}
          >
            <div
              className="mono"
              style={{ color: toast.kind === 'ok' ? '#22c55e' : '#f59e0b', fontSize: 12, fontWeight: 800 }}
            >
              {toast.kind === 'ok' ? 'OK' : 'WARN'}: {toast.msg}
            </div>
          </div>
        ) : null}
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
        <div
          className="layoutTwoCol"
          style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 380px', gap: 16, marginTop: 16 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <div className="grid2">
              {roles.map((r) => (
                <div
                  key={r}
                  style={{ background: '#1E2026', borderRadius: 6, border: '1px solid #2A2B30', padding: 12 }}
                >
                  <div className="spread">
                    <div className="roleTitle" style={{ fontWeight: 900, textTransform: 'lowercase' }}>
                      <span>{r}</span>
                      <span style={{ opacity: 0.9 }}>{roleEmoji[r]}</span>
                    </div>
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <Link
                        className="btn btnSm"
                        style={{ borderColor: '#3F3F46', color: '#a1a1aa', background: 'transparent' }}
                        to={`/tasks/${encodeURIComponent(taskId ?? '')}/console/${r}`}
                      >
                        console
                      </Link>
                      <span className={statusBadge(detail.agents[r].status)}>{detail.agents[r].status}</span>
                    </div>
                  </div>
                  <div className="mono" style={{ color: '#71717A', fontSize: 11, marginTop: 4 }}>
                    ANIMAL: {normalizeAnimalLabel(detail.agents[r].animal, r)}
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
                    disabled={busy !== null}
                    style={{ borderColor: '#22c55e', color: '#22c55e', background: 'transparent' }}
                    onClick={() => void runStage(stage)}
                  >
                    {busy === `stage:${stage}` ? (
                      <span className="row" style={{ gap: 8 }}>
                        <span className="spinner" />
                        …
                      </span>
                    ) : (
                      label
                    )}
                  </button>
                ))}
              </div>

              <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                <button
                  className="btn btnPrimary"
                  disabled={busy !== null}
                  onClick={() =>
                    void runBusy('orch:start:manual', async () => {
                      try {
                        await apiPost(`/api/tasks/${encodeURIComponent(taskId ?? '')}/orchestrate/start`, {
                          mode: 'manual-approve',
                        });
                        showToast('ok', 'Orchestrator started (manual)');
                        await refresh();
                      } catch (e) {
                        showToast('warn', String((e as Error).message || e));
                      }
                    })
                  }
                >
                  {busy === 'orch:start:manual' ? (
                    <span className="row" style={{ gap: 8 }}>
                      <span className="spinner" />
                      starting…
                    </span>
                  ) : (
                    'Start Orchestrator (manual)'
                  )}
                </button>

                <button
                  className="btn"
                  style={{ borderColor: '#22c55e', color: '#22c55e' }}
                  disabled={busy !== null}
                  onClick={() =>
                    void runBusy('orch:start:auto', async () => {
                      try {
                        await apiPost(`/api/tasks/${encodeURIComponent(taskId ?? '')}/orchestrate/start`, {
                          mode: 'auto-detect',
                        });
                        showToast('ok', 'Orchestrator started (auto-detect)');
                        await refresh();
                      } catch (e) {
                        showToast('warn', String((e as Error).message || e));
                      }
                    })
                  }
                >
                  {busy === 'orch:start:auto' ? (
                    <span className="row" style={{ gap: 8 }}>
                      <span className="spinner" />
                      starting…
                    </span>
                  ) : (
                    'Start Orchestrator (auto)'
                  )}
                </button>

                <button
                  className="btn"
                  style={{ borderColor: '#22c55e', color: '#22c55e' }}
                  disabled={busy !== null}
                  onClick={() =>
                    void runBusy('orch:approve', async () => {
                      try {
                        await apiPost(`/api/tasks/${encodeURIComponent(taskId ?? '')}/orchestrate/approve-next`, {});
                        showToast('ok', 'Approved next stage');
                        await refresh();
                      } catch (e) {
                        showToast('warn', String((e as Error).message || e));
                      }
                    })
                  }
                >
                  {busy === 'orch:approve' ? (
                    <span className="row" style={{ gap: 8 }}>
                      <span className="spinner" />
                      …
                    </span>
                  ) : (
                    'Approve Next'
                  )}
                </button>
                <button
                  className="btn btnOutlineWarn"
                  disabled={busy !== null}
                  onClick={() =>
                    void runBusy('orch:stop', async () => {
                      try {
                        await apiPost(`/api/tasks/${encodeURIComponent(taskId ?? '')}/orchestrate/stop`, {});
                        showToast('warn', 'Orchestrator stopped');
                        await refresh();
                      } catch (e) {
                        showToast('warn', String((e as Error).message || e));
                      }
                    })
                  }
                >
                  {busy === 'orch:stop' ? (
                    <span className="row" style={{ gap: 8 }}>
                      <span className="spinner" />
                      …
                    </span>
                  ) : (
                    'Stop Orchestrator'
                  )}
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
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
