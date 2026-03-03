import React from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiPost, type Task } from '../lib/api';

export function DashboardPage() {
  const [tasks, setTasks] = React.useState<Task[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  async function refresh() {
    try {
      setErr(null);
      setTasks(await apiGet<Task[]>('/api/tasks'));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  React.useEffect(() => {
    void refresh();
  }, []);

  async function newTask() {
    const summary = (prompt('Task summary?') ?? '').trim();
    if (!summary) return;
    const task = await apiPost<Task>('/api/tasks', { summary, agent: 'codex-pool' });
    location.href = `${import.meta.env.BASE_URL}tasks/${encodeURIComponent(task.id)}`;
  }

  return (
    <div className="container">
      <div className="card" style={{ background: '#212121', marginBottom: 16 }}>
        <div className="spread">
          <div className="row">
            <div style={{ width: 10, height: 10, borderRadius: 999, background: '#00D4AA' }} />
            <div style={{ fontWeight: 800, letterSpacing: 0.4 }}>
              AGENT_CONTROL_CENTER // runtime_overview
            </div>
          </div>
          <div className="row">
            <button className="btn btnPrimary" onClick={() => void newTask()}>
              new_task
            </button>
            <button className="btn" onClick={() => void refresh()}>
              refresh_log
            </button>
          </div>
        </div>
        {err ? <div style={{ marginTop: 10, color: '#ff6b35' }}>{err}</div> : null}
      </div>

      <div className="spread" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>// task_queue [high_density]</div>
        <div className="row mono" style={{ color: '#777', fontSize: 11 }}>
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
        </div>

        {tasks ? (
          tasks.map((t) => (
            <Link key={t.id} to={`/tasks/${encodeURIComponent(t.id)}`}>
              <div className="tableRow mono" style={{ marginBottom: 10 }}>
                <div className="colId">{t.id}</div>
                <div className="colSummary">{t.summary}</div>
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
                <div className="colEta" style={{ color: '#777' }}>{t.eta ?? ''}</div>
              </div>
            </Link>
          ))
        ) : (
          <div className="mono" style={{ color: '#777' }}>loading…</div>
        )}
      </div>
    </div>
  );
}
