import React from 'react';
import { Link } from 'react-router-dom';
import { apiDelete, apiGet, apiPost, type Task } from '../lib/api';

export function DashboardPage() {
  const [tasks, setTasks] = React.useState<Task[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const [oneLine, setOneLine] = React.useState<string>('');
  const [runMode, setRunMode] = React.useState<'manual' | 'auto'>('manual');

  async function refresh() {
    try {
      setErr(null);
      setTasks(await apiGet<Task[]>('/api/tasks'));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function runBusy(key: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  React.useEffect(() => {
    void refresh();
  }, []);

  async function newTask() {
    const summary = (prompt('Task summary?') ?? '').trim();
    if (!summary) return;
    await runBusy('new_task', async () => {
      const task = await apiPost<Task>('/api/tasks', { summary, agent: 'codex-pool' });
      location.href = `${import.meta.env.BASE_URL}tasks/${encodeURIComponent(task.id)}`;
    });
  }

  async function runOneLine() {
    const text = oneLine.trim();
    if (!text) return;
    await runBusy('one_line', async () => {
      const r = await apiPost<{ taskId: string }>('/api/projects/run', { text, mode: runMode });
      setOneLine('');
      location.href = `${import.meta.env.BASE_URL}tasks/${encodeURIComponent(r.taskId)}`;
    });
  }

  return (
    <div className="container">
      <div className="card dashboardTop" style={{ background: '#212121', marginBottom: 16 }}>
        <div className="dashboardHeaderGrid">
          <div className="dashboardHeaderBlock">
            <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: '#00D4AA',
                  flex: '0 0 auto',
                  marginTop: 10,
                }}
              />
              <div>
                <div className="mono" style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.2 }}>
                  AGENT_CONTROL_CENTER
                </div>
                <div className="mono" style={{ marginTop: 4, color: '#a1a1aa', fontSize: 14, fontWeight: 800 }}>
                  runtime_overview
                </div>
              </div>
            </div>
          </div>

          <div className="dashboardHeaderBlock">
            <div className="mono" style={{ color: '#a1a1aa', fontSize: 12, marginBottom: 6 }}>
              Run one-line (프로젝트 생성/개발/배포를 자연어로 요청)
            </div>
            <div className="row dashboardOneLineRow" style={{ gap: 8, flexWrap: 'wrap' }}>
              <input
                className="input mono"
                value={oneLine}
                onChange={(e) => setOneLine(e.target.value)}
                placeholder='예) "/home/sulee/projects/calendar-app 에서 일정관리 웹 만들어서 k8s personal /calendar/ 로 배포해줘"'
                style={{ flex: 1, minWidth: 280 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void runOneLine();
                }}
              />
              <select
                className="input mono"
                value={runMode}
                onChange={(e) => setRunMode(e.target.value === 'auto' ? 'auto' : 'manual')}
                style={{ flex: '0 0 140px' }}
                title="execution mode"
              >
                <option value="manual">manual</option>
                <option value="auto">auto</option>
              </select>
              <button className="btn btnPrimary" disabled={busy !== null || !oneLine.trim()} onClick={() => void runOneLine()}>
                {busy === 'one_line' ? (
                  <span className="row" style={{ gap: 8 }}>
                    <span className="spinner" />
                    starting…
                  </span>
                ) : (
                  'run'
                )}
              </button>
            </div>
          </div>

          <div className="dashboardHeaderBlock dashboardHeaderActions">
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button className="btn btnPrimary" disabled={busy !== null} onClick={() => void newTask()}>
                {busy === 'new_task' ? (
                  <span className="row" style={{ gap: 8 }}>
                    <span className="spinner" />
                    creating…
                  </span>
                ) : (
                  'new_task'
                )}
              </button>
              <Link className="btn btnOutlineSuccess" to="/help">
                help
              </Link>
              <button className="btn btnOutline" disabled={busy !== null} onClick={() => void refresh()}>
                refresh_log
              </button>
            </div>
          </div>
        </div>

        {err ? (
          <div style={{ marginTop: 10, color: '#ff6b35' }} className="small">
            {err}
          </div>
        ) : null}
      </div>

      <div className="card" style={{ background: '#212121' }}>
        <div className="dashboardQueueHeader" style={{ marginBottom: 12 }}>
          <div className="dashboardHeaderBlock">
            <div className="mono" style={{ fontSize: 16, fontWeight: 900, letterSpacing: -0.1 }}>task_queue</div>
            <div className="mono" style={{ marginTop: 4, color: '#a1a1aa', fontSize: 12, fontWeight: 800 }}>
              [high_density]
            </div>
          </div>
          <div className="dashboardHeaderBlock dashboardQueueBadges">
            <div className="row mono xs" style={{ color: '#777', justifyContent: 'flex-end' }}>
              <span className="badge badgeOk">● success</span>
              <span className="badge badgeWarn">● failure</span>
            </div>
          </div>
        </div>

        <div className="tableHead mono" style={{ marginBottom: 10 }}>
          <div className="colId">task_id</div>
          <div className="colSummary">summary</div>
          <div className="colAgent">agent</div>
          <div className="colStage">stage</div>
          <div className="colStatus">status</div>
          <div className="colEta">eta</div>
          <div style={{ flex: '0 0 160px', textAlign: 'right' }}>actions</div>
        </div>

        {tasks ? (
          tasks.map((t) => (
            <div key={t.id} style={{ marginBottom: 10 }}>
              <Link to={`/tasks/${encodeURIComponent(t.id)}`} style={{ textDecoration: 'none' }}>
                <div className="tableRow mono">
                  <div className="colId" title={t.id}>{t.id}</div>
                  <div className="colSummary" title={t.summary}>{t.summary}</div>
                  <div className="colAgent">{t.agent}</div>
                  <div className="colStage" style={{ color: t.stage === 'Plan' ? '#00d4aa' : '#fff' }}>
                    {t.stage}
                  </div>
                  <div
                    className="colStatus"
                    style={{ color: t.status === 'running' || t.status === 'done' ? '#00d4aa' : '#ff6b35' }}
                  >
                    {t.status}
                  </div>
                  <div className="colEta" style={{ color: '#777' }}>
                    {t.eta ?? ''}
                  </div>
                  <div style={{ flex: '0 0 160px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      className="btn btnOutlineWarn"
                      disabled={busy !== null}
                      onClick={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        void runBusy(`terminate:${t.id}`, async () => {
                          if (!confirm(`Terminate ${t.id}?`)) return;
                          await apiPost(`/api/tasks/${encodeURIComponent(t.id)}/terminate`, {});
                          await refresh();
                        });
                      }}
                    >
                      {busy === `terminate:${t.id}` ? (
                        <span className="row" style={{ gap: 8 }}>
                          <span className="spinner" />
                          …
                        </span>
                      ) : (
                        'terminate'
                      )}
                    </button>
                    <button
                      className="btn"
                      style={{ borderColor: '#f59e0b', color: '#f59e0b' }}
                      disabled={busy !== null}
                      onClick={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        void runBusy(`delete:${t.id}`, async () => {
                          if (!confirm(`Delete ${t.id}? This cannot be undone.`)) return;
                          await apiDelete(`/api/tasks/${encodeURIComponent(t.id)}`);
                          await refresh();
                        });
                      }}
                    >
                      {busy === `delete:${t.id}` ? (
                        <span className="row" style={{ gap: 8 }}>
                          <span className="spinner" />
                          …
                        </span>
                      ) : (
                        'delete'
                      )}
                    </button>
                  </div>
                </div>
              </Link>
            </div>
          ))
        ) : (
          <div className="mono" style={{ color: '#777' }}>loading…</div>
        )}
      </div>
    </div>
  );
}
