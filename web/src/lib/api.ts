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

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}
