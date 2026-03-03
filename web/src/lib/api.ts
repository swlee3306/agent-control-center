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

function withBase(path: string) {
  // If path starts with '/', treat it as app-root relative (respect BASE_URL subpath).
  if (path.startsWith('/')) {
    return `${import.meta.env.BASE_URL}${path.slice(1)}`;
  }
  return `${import.meta.env.BASE_URL}${path}`;
}

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (data?.error) return data.error;
  } catch {
    // ignore
  }
  return `${res.status} ${res.statusText}`;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(withBase(path));
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(withBase(path), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as T;
}
