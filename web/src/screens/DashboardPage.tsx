import React from 'react';
import { Link } from 'react-router-dom';
import { apiDelete, apiGet, apiPost, type Task } from '../lib/api';

export function DashboardPage() {
  const [tasks, setTasks] = React.useState<Task[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

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

  return (
    <div className="container">
      <div className="card" style={{ background: '#212121', marginBottom: 16 }}>
        <div className="spread" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div className="row" style={{ gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: 999, background: '#00D4AA', flex: '0 0 auto' }} />
            <div className="mono h2" style={{ fontWeight: 900, letterSpacing: 0.2 }}>
              AGENT_CONTROL_CENTER // runtime_overview
            </div>
          </div>
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
        {err ? <div style={{ marginTop: 10, color: '#ff6b35' }} className="small">{err}</div> : null}
      </div>

      <div className="spread" style={{ marginBottom: 12 }}>
        <div className="h2">// task_queue [high_density]</div>
        <div className="row mono xs" style={{ color: '#777' }}>
          <span className="badge badgeOk">● success</span>
          <span className="badge badgeWarn">● failure</span>
        </div>
      </div>

      <div className="card" style={{ background: '#212121' }}>
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
