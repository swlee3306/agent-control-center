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

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const now = () => new Date().toISOString().replace('T', ' ').replace('Z', ' UTC');

type StoreState = {
  tasks: Record<string, Task>;
  details: Record<string, TaskDetail>;
};

const STORE_PATH = process.env.ACC_STORE_PATH ?? '/data/acc-store.json';

function seedDemo(): StoreState {
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

  return { tasks: { [task.id]: task }, details: { [task.id]: detail } };
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
}

function loadStore(): StoreState {
  try {
    if (!fs.existsSync(STORE_PATH)) return seedDemo();
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = safeParse(raw) as Partial<StoreState> | null;
    if (!parsed || !parsed.tasks || !parsed.details) return seedDemo();
    return {
      tasks: parsed.tasks as StoreState['tasks'],
      details: parsed.details as StoreState['details'],
    };
  } catch {
    return seedDemo();
  }
}

const state: StoreState = loadStore();
let saveTimer: NodeJS.Timeout | null = null;

function ensureDir(p: string) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      ensureDir(STORE_PATH);
      const tmp = `${STORE_PATH}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
      fs.renameSync(tmp, STORE_PATH);
    } catch {
      // ignore (best-effort persistence)
    }
  }, 250);
}

function newTaskId() {
  const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const rand = crypto.randomBytes(2).toString('hex');
  return `tsk_${ts}_${rand}`;
}

export function listTasks(): Task[] {
  return Object.values(state.tasks).sort((a, b) => (a.id < b.id ? 1 : -1));
}

export function getTaskDetail(id: string): TaskDetail {
  const d = state.details[id];
  if (!d) throw new Error('not found');
  d.updatedAtUtc = now();
  return d;
}

export function createTask(input: { summary: string; agent?: string; id?: string }): Task {
  const id = (input.id ?? '').trim() || newTaskId();
  if (state.tasks[id]) throw new Error('id already exists');

  const task: Task = {
    id,
    summary: input.summary,
    agent: input.agent ?? 'codex-pool',
    stage: 'Plan',
    status: 'idle',
    eta: '--:--',
  };

  const detail: TaskDetail = {
    id,
    title: `TASK_DETAIL // ${id}`,
    updatedAtUtc: now(),
    status: task.status,
    summary: input.summary,
    agents: {
      architect: { animal: 'OWL', line: 'Ready.', status: 'idle' },
      executor: { animal: 'WOLF', line: 'Ready.', status: 'idle' },
      qa: { animal: 'MEERKAT', line: 'Ready.', status: 'idle' },
      reviewer: { animal: 'FALCON', line: 'Ready.', status: 'idle' },
    },
    timeline: [],
  };

  state.tasks[id] = task;
  state.details[id] = detail;
  scheduleSave();
  return task;
}

export function pushTimeline(id: string, msg: string, level: 'ok' | 'warn' | 'neutral' = 'neutral') {
  const d = state.details[id];
  if (!d) return;
  const t = new Date().toISOString().slice(11, 19);
  d.timeline.unshift({ t, msg, level });
  d.timeline = d.timeline.slice(0, 200);
  scheduleSave();
}
