export type AgentRole = 'architect' | 'executor' | 'qa' | 'reviewer';
export type Stage = 'Plan' | 'Exec' | 'Verify' | 'Review' | 'Fix Loop';
export type Status = 'idle' | 'running' | 'done' | 'error' | 'timeout' | 'blocked';

export type Task = {
  id: string;
  summary: string;
  agent: string;
  stage: Stage;
  status: Status;
  eta?: string;
};

export type TaskDetail = {
  id: string;
  title: string;
  updatedAtUtc: string;
  status: Status;
  summary: string;
  agents: Record<AgentRole, { animal: string; line: string; status: Status }>;
  timeline: Array<{ t: string; level: 'ok' | 'warn' | 'neutral'; msg: string }>;
};

// MVP: in-memory store with a single demo task.
const now = () => new Date().toISOString().replace('T', ' ').replace('Z', ' UTC');

const task: Task = {
  id: 'tsk_demo',
  summary: 'agent control center MVP (tmux-backed)',
  agent: 'codex-pool',
  stage: 'Plan',
  status: 'running',
  eta: '--:--',
};

const detail: TaskDetail = {
  id: task.id,
  title: 'TASK_DETAIL // AGENT_CONTROL_CENTER',
  updatedAtUtc: now(),
  status: task.status,
  summary:
    'Orchestrate multi-stage work across architect/executor/qa/reviewer with fix-loop and tmux-backed logs.',
  agents: {
    architect: { animal: 'OWL', line: 'Designing remediation plan graph and dependency map.', status: 'running' },
    executor: { animal: 'WOLF', line: 'Running command batches across build, deploy, and rollback stages.', status: 'idle' },
    qa: { animal: 'MEERKAT', line: 'Executing regression tests and collecting verification evidence.', status: 'idle' },
    reviewer: { animal: 'FALCON', line: 'Checking policy compliance, approving merge, and publishing notes.', status: 'idle' },
  },
  timeline: [
    { t: '14:38:22', level: 'neutral', msg: 'executor> ./deploy --safe-mode' },
    { t: '14:38:41', level: 'warn', msg: 'qa> integration_suite: 67/72 passed' },
  ],
};

export function listTasks(): Task[] {
  return [task];
}

export function getTaskDetail(id: string): TaskDetail {
  if (id !== task.id) throw new Error('not found');
  detail.updatedAtUtc = now();
  return detail;
}

export function pushTimeline(id: string, msg: string, level: 'ok' | 'warn' | 'neutral' = 'neutral') {
  if (id !== task.id) return;
  const d = new Date();
  const t = d.toISOString().slice(11, 19);
  detail.timeline.unshift({ t, msg, level });
  detail.timeline = detail.timeline.slice(0, 200);
}
