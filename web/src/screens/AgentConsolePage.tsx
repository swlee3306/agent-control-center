import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiPost, type AgentRole, type TaskDetail } from '../lib/api';

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

function HighlightedLine({ line, re, enabled }: { line: string; re: RegExp | null; enabled: boolean }) {
  if (!enabled || !re) return <>{line}</>;
  const parts = line.split(re);
  const matches = line.match(re) ?? [];
  return (
    <>
      {parts.map((p, j) => (
        <React.Fragment key={j}>
          {p}
          {j < matches.length ? (
            <span style={{ background: '#F59E0B22', color: '#F59E0B', fontWeight: 800 }}>{matches[j]}</span>
          ) : null}
        </React.Fragment>
      ))}
    </>
  );
}

const roleProfile: Record<AgentRole, { label: string; emoji: string; accent: string }> = {
  architect: { label: 'OWL_ARCHITECT', emoji: '🦉', accent: '#22C55E' },
  executor: { label: 'FOX_EXECUTOR', emoji: '🦊', accent: '#22C55E' },
  qa: { label: 'OTTER_QA', emoji: '🦦', accent: '#22C55E' },
  reviewer: { label: 'HAWK_REVIEWER', emoji: '🦅', accent: '#22C55E' },
};

function stableNumber(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function AgentConsolePage() {
  const { taskId, role } = useParams();
  const navigate = useNavigate();

  const agentRole = (role as AgentRole | undefined) ?? 'executor';
  const profile = roleProfile[agentRole] ?? roleProfile.executor;

  const [detail, setDetail] = React.useState<TaskDetail | null>(null);
  const [logText, setLogText] = React.useState('');
  const [q, setQ] = React.useState('');
  const [regexMode, setRegexMode] = React.useState(false);
  const [caseSensitive, setCaseSensitive] = React.useState(false);
  const [highlight, setHighlight] = React.useState(true);
  const [marks, setMarks] = React.useState<number[]>([]);
  const [cmd, setCmd] = React.useState('');
  const [err, setErr] = React.useState<string | null>(null);
  const termRef = React.useRef<HTMLDivElement | null>(null);

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

  React.useEffect(() => {
    const wsUrl = `${location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as { type: string; role?: string; text?: string };
        if (msg.type === 'role_log' && msg.role === agentRole && typeof msg.text === 'string') {
          setLogText(msg.text);
        }
      } catch {
        // ignore
      }
    });

    return () => ws.close();
  }, [agentRole]);

  const { re, err: reErr } = React.useMemo(() => compileQuery(q, regexMode, caseSensitive), [q, regexMode, caseSensitive]);

  const lines = React.useMemo(() => (logText || '').split('\n'), [logText]);

  const matchLineIdxs = React.useMemo(() => {
    if (!re) return [];
    if (reErr) return [];
    const idxs: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) idxs.push(i);
    }
    return idxs;
  }, [lines, re, reErr]);

  const pid = React.useMemo(() => 3000 + (stableNumber(`${taskId ?? ''}:${agentRole}`) % 5000), [agentRole, taskId]);
  const latency = React.useMemo(() => 10 + (stableNumber(`${agentRole}:${taskId ?? ''}:lat`) % 90), [agentRole, taskId]);

  async function sendCommand() {
    if (!taskId) return;
    const text = cmd.trim();
    if (!text) return;
    setCmd('');
    await apiPost(`/api/tasks/${encodeURIComponent(taskId)}/command`, { role: agentRole, text });
    await refresh();
  }

  function addBookmark() {
    const el = termRef.current;
    const topLine = el ? Math.max(0, Math.floor(el.scrollTop / 16) - 1) : Math.max(0, lines.length - 1);
    const chosen = matchLineIdxs.find((i) => i >= topLine) ?? Math.max(0, lines.length - 1);
    setMarks((prev) => (prev.includes(chosen) ? prev : [...prev, chosen].sort((a, b) => a - b)));
  }

  function jumpToMark(i: number) {
    const el = termRef.current;
    if (!el) return;
    el.scrollTop = Math.max(0, i * 16 - 16);
  }

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', padding: 20 }}>
      <div
        style={{
          background: '#1E2026',
          border: '1px solid #2A2B30',
          borderRadius: 6,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ color: '#F4F4F5', fontSize: 28, fontWeight: 900, letterSpacing: -0.5 }}>AGENT CONSOLE</div>
          <div style={{ color: '#71717A' }} className="mono">
            // ROLE_PRIMARY_AGENT : {profile.label}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div
            style={{
              height: 30,
              background: '#16171B',
              borderRadius: 4,
              border: `1px solid ${profile.accent}`,
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span className="mono" style={{ color: profile.accent, fontSize: 10, fontWeight: 900 }}>
              {detail?.agents?.[agentRole]?.status ? detail.agents[agentRole].status.toUpperCase() : 'LIVE'}
            </span>
          </div>

          <Link
            to={`/tasks/${encodeURIComponent(taskId ?? '')}`}
            style={{
              height: 34,
              background: '#232529',
              borderRadius: 4,
              border: '1px solid #2A2B30',
              padding: '8px 12px',
              color: '#F4F4F5',
              textDecoration: 'none',
            }}
            className="mono"
          >
            &lt;- BACK TO TASK {taskId ?? ''}
          </Link>
        </div>
      </div>

      {err ? <div style={{ marginTop: 12, color: '#FF6B35' }}>{err}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 16, marginTop: 16 }}>
        {/* left: log + command */}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              background: '#1E2026',
              border: '1px solid #2A2B30',
              borderRadius: 6,
              padding: '8px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={regexMode ? 'regex search…' : 'search logs…'}
                className="mono"
                style={{
                  width: 350,
                  maxWidth: '100%',
                  height: 28,
                  background: '#16171B',
                  borderRadius: 4,
                  border: '1px solid #3F3F46',
                  padding: '6px 10px',
                  color: '#F4F4F5',
                  outline: 'none',
                }}
              />

              <label
                className="mono"
                style={{
                  height: 28,
                  background: '#232529',
                  borderRadius: 4,
                  border: `1px solid ${highlight ? '#F59E0B' : '#2A2B30'}`,
                  padding: '6px 10px',
                  color: highlight ? '#F59E0B' : '#F4F4F5',
                  fontSize: 10,
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} />
                HIGHLIGHT
              </label>

              <button
                className="mono"
                onClick={addBookmark}
                style={{
                  height: 28,
                  background: '#232529',
                  borderRadius: 4,
                  border: '1px solid #2A2B30',
                  padding: '6px 10px',
                  color: '#F4F4F5',
                  fontSize: 10,
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                BOOKMARK
              </button>

              <label className="mono" style={{ color: '#A1A1AA', fontSize: 10, fontWeight: 800, display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={regexMode} onChange={(e) => setRegexMode(e.target.checked)} />
                regex
              </label>
              <label className="mono" style={{ color: '#A1A1AA', fontSize: 10, fontWeight: 800, display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} />
                Aa
              </label>
            </div>

            <div className="mono" style={{ color: '#52525B', fontSize: 10, fontWeight: 800 }}>
              MATCHES {matchLineIdxs.length} | MARKS {marks.length}
            </div>
          </div>

          {reErr ? <div className="mono" style={{ color: '#F59E0B', fontSize: 11 }}>regex error: {reErr}</div> : null}

          <div
            ref={termRef}
            style={{
              background: '#16171B',
              border: '1px solid #2A2B30',
              borderRadius: 6,
              padding: 12,
              height: 520,
              overflow: 'auto',
              fontFamily: 'Roboto Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: 10,
              lineHeight: '16px',
              color: '#F4F4F5',
              whiteSpace: 'pre',
            }}
          >
            {lines.length ? (
              lines.map((line, i) => (
                <div key={i} style={{ color: marks.includes(i) ? '#22C55E' : undefined }}>
                  <span style={{ color: '#52525B', userSelect: 'none' }}>{String(i + 1).padStart(4, ' ')} </span>
                  <HighlightedLine line={line} re={re} enabled={highlight} />
                </div>
              ))
            ) : (
              <div style={{ color: '#52525B' }}>(waiting for tmux log…)</div>
            )}
          </div>

          {marks.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {marks.map((m) => (
                <button
                  key={m}
                  className="mono"
                  onClick={() => jumpToMark(m)}
                  style={{
                    background: '#1E2026',
                    border: '1px solid #2A2B30',
                    borderRadius: 6,
                    padding: '8px 10px',
                    color: '#22C55E',
                    cursor: 'pointer',
                    fontSize: 10,
                    fontWeight: 900,
                  }}
                >
                  MARK #{m + 1}
                </button>
              ))}
              <button
                className="mono"
                onClick={() => setMarks([])}
                style={{
                  background: '#1E2026',
                  border: '1px solid #2A2B30',
                  borderRadius: 6,
                  padding: '8px 10px',
                  color: '#A1A1AA',
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: 900,
                }}
              >
                CLEAR MARKS
              </button>
            </div>
          ) : null}

          <div
            style={{
              background: '#1E2026',
              border: '1px solid #2A2B30',
              borderRadius: 6,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div className="mono" style={{ color: '#71717A', fontSize: 11, fontWeight: 800 }}>
              // COMMAND_FOCUS
            </div>
            <div
              style={{
                background: '#16171B',
                border: `1px solid ${profile.accent}`,
                borderRadius: 6,
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <input
                value={cmd}
                onChange={(e) => setCmd(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void sendCommand();
                  if (e.key === 'Escape') setCmd('');
                }}
                placeholder={`$ run --agent ${profile.label} --step ...`}
                className="mono"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: profile.accent,
                  fontWeight: 800,
                  fontSize: 11,
                }}
              />
              <span className="mono" style={{ color: '#52525B', fontSize: 9, fontWeight: 900 }}>
                ENTER TO EXECUTE
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="mono"
                onClick={() => void sendCommand()}
                style={{
                  background: '#232529',
                  border: '1px solid #2A2B30',
                  borderRadius: 6,
                  padding: '10px 12px',
                  color: '#F4F4F5',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 900,
                }}
              >
                SEND
              </button>
              <button
                className="mono"
                onClick={() => navigate(`/tasks/${encodeURIComponent(taskId ?? '')}`)}
                style={{
                  background: 'transparent',
                  border: '1px solid #2A2B30',
                  borderRadius: 6,
                  padding: '10px 12px',
                  color: '#A1A1AA',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 900,
                }}
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>

        {/* right: context rail */}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: '#1E2026', border: '1px solid #2A2B30', borderRadius: 6, padding: 12 }}>
            <div className="mono" style={{ color: '#71717A', fontSize: 11, fontWeight: 800 }}>
              // AGENT_PROFILE
            </div>
            <div style={{ marginTop: 10, fontSize: 36, fontWeight: 900 }}>{profile.emoji}</div>
            <div className="mono" style={{ marginTop: 8, color: '#F4F4F5', fontSize: 12, fontWeight: 900 }}>
              ROLE_PRIMARY_AGENT
            </div>
            <div style={{ marginTop: 6, color: profile.accent, fontSize: 16, fontWeight: 900, fontFamily: 'Space Grotesk, system-ui' }}>
              {profile.label}
            </div>
            <div className="mono" style={{ marginTop: 8, color: '#52525B', fontSize: 10, fontWeight: 700 }}>
              PID {pid} | REGION local | LATENCY {latency}ms
            </div>
          </div>

          <div style={{ background: '#1E2026', border: '1px solid #2A2B30', borderRadius: 6, padding: 12 }}>
            <div className="mono" style={{ color: '#71717A', fontSize: 11, fontWeight: 800 }}>
              // TASK_PROGRESS
            </div>
            <div style={{ marginTop: 10, background: '#16171B', border: '1px solid #3F3F46', borderRadius: 6, height: 22, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${detail?.status === 'done' ? 100 : detail?.status === 'running' ? 68 : 10}%`,
                  height: '100%',
                  background: profile.accent,
                }}
              />
            </div>
            <div className="mono" style={{ marginTop: 10, color: '#F4F4F5', fontSize: 10 }}>
              [x] stream log attached
            </div>
            <div className="mono" style={{ marginTop: 6, color: '#F4F4F5', fontSize: 10 }}>
              [x] command channel ready
            </div>
            <div className="mono" style={{ marginTop: 6, color: '#F59E0B', fontSize: 10 }}>
              [ ] patch and verify
            </div>
          </div>

          <div style={{ background: '#1E2026', border: '1px solid #2A2B30', borderRadius: 6, padding: 12, flex: 1 }}>
            <div className="mono" style={{ color: '#71717A', fontSize: 11, fontWeight: 800 }}>
              // SYSTEM_STATUS
            </div>
            <div className="mono" style={{ marginTop: 10, color: '#22C55E', fontSize: 10, fontWeight: 900 }}>
              STREAM: LIVE
            </div>
            <div className="mono" style={{ marginTop: 6, color: '#F4F4F5', fontSize: 10, fontWeight: 900 }}>
              PERMISSION: ELEVATED
            </div>
            <div className="mono" style={{ marginTop: 6, color: '#22C55E', fontSize: 10, fontWeight: 900 }}>
              LAST_ERROR: NONE
            </div>
            <div className="mono" style={{ marginTop: 6, color: '#F4F4F5', fontSize: 10, fontWeight: 900 }}>
              TASK_STAGE: {detail?.status ? detail.status.toUpperCase() : 'UNKNOWN'}
            </div>
            <div className="mono" style={{ marginTop: 6, color: '#F4F4F5', fontSize: 10, fontWeight: 900 }}>
              QUEUE_DEPTH: 03
            </div>
            <div className="mono" style={{ marginTop: 6, color: '#F4F4F5', fontSize: 10, fontWeight: 900 }}>
              LOADING: BUFFER_SYNC_OK
            </div>
            <div className="mono" style={{ marginTop: 6, color: '#52525B', fontSize: 10, fontWeight: 900 }}>
              EMPTY_STATE: {lines.length ? 'HIDDEN (HAS_LOGS)' : 'VISIBLE'}
            </div>
            <div className="mono" style={{ marginTop: 6, color: '#22C55E', fontSize: 10, fontWeight: 900 }}>
              ERROR_STATE: NONE
            </div>
            <div className="mono" style={{ marginTop: 6, color: '#22C55E', fontSize: 10, fontWeight: 900 }}>
              SUCCESS_CONFIRM: READY
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
