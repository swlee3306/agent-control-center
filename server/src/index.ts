import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { listTasks, getTaskDetail, pushTimeline, createTask, setTaskState, deleteTask } from './store.js';
import {
  tmuxCapture,
  tmuxListPanes,
  tmuxPaneCurrentCommand,
  tmuxResolvePaneIndexByTitle,
  tmuxSend,
  tmuxSetPaneTitle,
  type TmuxTarget,
} from './tmux.js';

const PORT = Number(process.env.PORT ?? 8787);

const ACC_TMUX_SOCKET = process.env.ACC_TMUX_SOCKET ?? '/tmp/openclaw-tmux-sockets/openclaw.sock';
const ACC_TMUX_SESSION = process.env.ACC_TMUX_SESSION ?? 'codex-pool';

const tmuxTarget: TmuxTarget = { socket: ACC_TMUX_SOCKET, session: ACC_TMUX_SESSION };

const roleToPane: Record<string, number> = {
  // Fallback mapping; prefer resolving by pane_title (architect/executor/qa/reviewer)
  architect: 0,
  executor: 1,
  qa: 2,
  reviewer: 3,
};

async function resolveRolePaneIndex(role: string): Promise<number> {
  const byTitle = await tmuxResolvePaneIndexByTitle(tmuxTarget, role).catch(async () => {
    // Helps diagnose pane-title mapping issues; errors are ignored.
    await tmuxListPanes(tmuxTarget).catch(() => []);
    return null;
  });
  if (typeof byTitle === 'number') return byTitle;
  return roleToPane[role] ?? roleToPane.executor;
}

const app = express();
app.use(express.json({ limit: '1mb' }));

// Serve built web UI if present (container deploy path: /app/public)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = process.env.ACC_PUBLIC_DIR ?? path.resolve(__dirname, '../public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// SPA fallback
app.get('/', (_req, res) => {
  const indexHtml = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexHtml)) return res.sendFile(indexHtml);
  res.type('text').send('acc-server: web not built');
});

app.get('/api/tasks', (_req, res) => {
  res.json(listTasks());
});

app.post('/api/tasks', (req, res) => {
  const body = req.body as Partial<{ id: string; summary: string; agent: string }>;
  const summary = (body.summary ?? '').trim();
  if (!summary) return res.status(400).json({ error: 'missing summary' });

  try {
    const task = createTask({ summary, agent: body.agent, id: body.id });
    res.json(task);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

function slugify(input: string) {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
  return s || '';
}

function extractAbsPath(text: string) {
  // First absolute-ish path occurrence.
  // Example: /home/user/projects/app, /tmp/foo
  const m = text.match(/\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*/);
  return m?.[0];
}

type RunMode = 'manual' | 'auto';

app.post('/api/projects/run', async (req, res) => {
  const body = req.body as Partial<{ text: string; mode: RunMode }>;
  const intent = String(body.text ?? '').trim();
  const mode: RunMode = body.mode === 'auto' ? 'auto' : 'manual';
  if (!intent) return res.status(400).json({ error: 'missing text' });

  const username = os.userInfo().username || 'user';
  const baseDir = path.join('/home', username, 'projects');
  const extracted = extractAbsPath(intent);

  // Heuristic name: first token-ish word, else timestamp.
  const firstWord = (intent.match(/[A-Za-z0-9][A-Za-z0-9_-]{1,40}/)?.[0] ?? '').trim();
  const projectName = slugify(firstWord) || `project-${new Date().toISOString().slice(0, 10)}`;

  const rootDir = extracted ? extracted : path.join(baseDir, projectName);

  try {
    fs.mkdirSync(rootDir, { recursive: true });
  } catch (e) {
    return res.status(400).json({ error: `failed to create dir: ${(e as Error).message}` });
  }

  const task = createTask({ summary: `project_build: ${projectName} — ${intent}`, agent: 'codex-pool' });
  setTaskState(task.id, {
    meta: {
      type: 'project_build',
      intent,
      rootDir,
      mode,
      defaults: { baseDir, namespace: 'personal', deploy: 'k8s-subpath' },
    },
  });

  pushTimeline(task.id, `project> kickoff (${mode})`, 'ok');
  pushTimeline(task.id, `project> rootDir=${rootDir}`, 'neutral');

  // Kick off an architect prompt in tmux.
  const targetPane = await resolveRolePaneIndex('architect');
  const kickoff = [
    'You are ARCHITECT for a new PROJECT BUILD task.',
    '',
    `User intent: ${intent}`,
    `Working directory (must exist): ${rootDir}`,
    '',
    'Defaults (if user did not specify):',
    '- Base dir: /home/<username>/projects (create if missing)',
    '- Deploy: k8s (namespace=personal) + subpath ingress',
    '- Safe mode: manual approvals by default (auto is allowed if explicitly chosen)',
    '',
    'Your job:',
    '1) Ask clarifying questions ONLY if needed (stack: web/framework, backend language, DB, auth, deploy style).',
    '2) Propose a plan (TL;DR + tasks <= 10 + DoD).',
    '3) Hand off to EXECUTOR with concrete next steps, file paths, and commands.',
    '',
    'Rules:',
    '- Keep changes minimal and reversible.',
    '- If requirements are ambiguous, ask before implementing.',
    '- Always include the chosen stack/deploy decisions in your plan.',
  ].join('\n');

  try {
    setTaskState(task.id, { stage: 'Plan', status: 'running' });
    const current = await tmuxPaneCurrentCommand(tmuxTarget, targetPane).catch(() => '');
    const isCodex = current === 'codex' || current === 'node';
    if (isCodex) {
      await tmuxSend(tmuxTarget, targetPane, kickoff);
    } else {
      const cmd = `codex --yolo ${bashDollarString(kickoff)}`;
      await tmuxSend(tmuxTarget, targetPane, cmd);
    }
    pushTimeline(task.id, `project> architect_kickoff (${isCodex ? 'prompt' : 'spawn codex'})`, 'ok');
  } catch (e) {
    pushTimeline(task.id, `project_kickoff_failed: ${(e as Error).message}`, 'warn');
  }

  res.json({ ok: true, taskId: task.id, rootDir, mode });
});

app.delete('/api/tasks/:id', (req, res) => {
  try {
    deleteTask(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

app.post('/api/tasks/:id/terminate', (req, res) => {
  // Soft-terminate: stop orchestrator (if any) and mark task terminated.
  try {
    orchStop(req.params.id, 'terminate');
    setTaskState(req.params.id, { status: 'terminated' });
    pushTimeline(req.params.id, 'task> terminated', 'warn');
    res.json({ ok: true });
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

app.get('/api/tasks/:id', (req, res) => {
  try {
    res.json(getTaskDetail(req.params.id));
  } catch {
    res.status(404).json({ error: 'not found' });
  }
});

app.post('/api/tasks/:id/command', async (req, res) => {
  const { role, text } = req.body as { role?: string; text?: string };
  const cmd = (text ?? '').trim();
  if (!cmd) return res.status(400).json({ error: 'missing text' });

  const targetPane = role ? await resolveRolePaneIndex(role) : await resolveRolePaneIndex('executor');

  pushTimeline(req.params.id, `ui>${role ? ` @${role}` : ''} ${cmd}`, 'neutral');

  try {
    await tmuxSend(tmuxTarget, targetPane, cmd);
    res.json({ ok: true });
  } catch (e) {
    pushTimeline(req.params.id, `send_failed: ${(e as Error).message}`, 'warn');
    res.status(500).json({ error: 'send failed' });
  }
});

type Stage = 'Plan' | 'Exec' | 'Verify' | 'Review' | 'Fix Loop';

function bashDollarString(input: string) {
  // Produce a safe $'..' string for bash/zsh that preserves newlines.
  // Escapes: backslash, single quote, and control chars.
  return (
    "$'" +
    input
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t') +
    "'"
  );
}

const stageTemplates: Record<Stage, { role: keyof typeof roleToPane; text: string }> = {
  Plan: {
    role: 'architect',
    text: [
      'You are ARCHITECT. Produce a concise plan for the current task.',
      'Output format:',
      '- TL;DR (3 bullets)',
      '- Design (components/data/API)',
      '- Task breakdown (<=10)',
      '- DoD (commands to verify)',
      '- Risks/rollback',
    ].join('\n'),
  },
  Exec: {
    role: 'executor',
    text: [
      'You are EXECUTOR. Implement the plan. Keep changes minimal and reversible.',
      'Rules: if unsure, ask. Provide file paths and short status updates.',
    ].join('\n'),
  },
  Verify: {
    role: 'qa',
    text: [
      'You are QA. Verify the implementation.',
      'Run tests/lint if available. Output only PASS/FAIL with minimal evidence.',
    ].join('\n'),
  },
  Review: {
    role: 'reviewer',
    text: [
      'You are REVIEWER. Review for security/performance/ops risks.',
      'Output: decision (approve/hold) + top issues + quick wins.',
    ].join('\n'),
  },
  'Fix Loop': {
    role: 'executor',
    text: [
      'You are EXECUTOR in FIX LOOP mode.',
      'Take the latest QA/Review failures, apply minimal fixes, and request re-verify.',
    ].join('\n'),
  },
};

app.post('/api/tasks/:id/stage', async (req, res) => {
  const stage = (req.body as { stage?: Stage }).stage;
  if (!stage || !(stage in stageTemplates)) return res.status(400).json({ error: 'invalid stage' });

  const tpl = stageTemplates[stage];
  const targetPane = await resolveRolePaneIndex(tpl.role);
  pushTimeline(req.params.id, `stage>${stage} -> @${tpl.role}`, 'neutral');

  try {
    // Mark task as running on stage send
    setTaskState(req.params.id, { stage, status: 'running' });

    // Smart mode:
    // - If codex is already running in the pane, just send the prompt.
    // - Otherwise, start codex --yolo with the prompt so it still works.
    const current = await tmuxPaneCurrentCommand(tmuxTarget, targetPane).catch(() => '');
    const isCodex = current === 'codex' || current === 'node';

    if (isCodex) {
      await tmuxSend(tmuxTarget, targetPane, tpl.text);
    } else {
      const cmd = `codex --yolo ${bashDollarString(tpl.text)}`;
      await tmuxSend(tmuxTarget, targetPane, cmd);
    }

    pushTimeline(req.params.id, `stage_sent: ${stage} (${isCodex ? 'prompt' : 'spawn codex'})`, 'ok');
    res.json({ ok: true, mode: isCodex ? 'prompt' : 'spawn' });
  } catch (e) {
    pushTimeline(req.params.id, `stage_failed: ${(e as Error).message}`, 'warn');
    res.status(500).json({ error: 'stage failed' });
  }
});

app.get('/api/tmux/:role/log', async (req, res) => {
  const role = req.params.role;
  if (!(role in roleToPane)) return res.status(404).json({ error: 'unknown role' });
  const lines = Math.max(20, Math.min(2000, Number(req.query.lines ?? 200)));

  try {
    const pane = await resolveRolePaneIndex(role);
    const text = await tmuxCapture(tmuxTarget, pane, lines);
    res.json({ role, text });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.post('/api/tmux/sync-titles', async (_req, res) => {
  // Force pane titles to match role names.
  // Uses canonical pane indices 0..3 so title mapping becomes stable again.
  try {
    await tmuxSetPaneTitle(tmuxTarget, 0, 'architect');
    await tmuxSetPaneTitle(tmuxTarget, 1, 'executor');
    await tmuxSetPaneTitle(tmuxTarget, 2, 'qa');
    await tmuxSetPaneTitle(tmuxTarget, 3, 'reviewer');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

type OrchestratorMode = 'auto-detect' | 'manual-approve';

type OrchestratorState = {
  taskId: string;
  mode: OrchestratorMode;
  seq: Stage[];
  idx: number;
  startedAtMs: number;
  stageStartedAtMs: number;
  awaitingApproval: boolean;
  timer?: NodeJS.Timeout;
};

const orchByTask = new Map<string, OrchestratorState>();

const stageTimeoutMs: Record<Stage, number> = {
  Plan: 10 * 60 * 1000,
  Exec: 30 * 60 * 1000,
  Verify: 15 * 60 * 1000,
  Review: 10 * 60 * 1000,
  'Fix Loop': 20 * 60 * 1000,
};

function stageRole(stage: Stage): keyof typeof roleToPane {
  if (stage === 'Plan') return 'architect';
  if (stage === 'Exec') return 'executor';
  if (stage === 'Verify') return 'qa';
  return 'reviewer';
}

function detectCompletion(stage: Stage, logText: string) {
  const t = logText.toLowerCase();
  if (stage === 'Verify') {
    if (/(^|\b)pass(\b|$)/m.test(t)) return { done: true, ok: true };
    if (/(^|\b)fail(\b|$)/m.test(t)) return { done: true, ok: false };
  }
  if (stage === 'Review') {
    if (/\bapprove\b/.test(t)) return { done: true, ok: true };
    if (/\bhold\b/.test(t)) return { done: true, ok: false };
  }
  // Plan/Exec/Fix Loop: no reliable auto-detect yet
  return { done: false as const };
}

async function orchSendStage(taskId: string, stage: Stage) {
  // reuse stage endpoint logic: send prompt and set running
  const tpl = stageTemplates[stage];
  const pane = await resolveRolePaneIndex(tpl.role);
  const current = await tmuxPaneCurrentCommand(tmuxTarget, pane).catch(() => '');
  const isCodex = current === 'codex' || current === 'node';

  setTaskState(taskId, { stage, status: 'running' });
  pushTimeline(taskId, `orch> ${stage} -> @${tpl.role}`, 'neutral');

  if (isCodex) {
    await tmuxSend(tmuxTarget, pane, tpl.text);
  } else {
    const cmd = `codex --yolo ${bashDollarString(tpl.text)}`;
    await tmuxSend(tmuxTarget, pane, cmd);
  }
}

function orchStop(taskId: string, reason?: string) {
  const orch = orchByTask.get(taskId);
  if (!orch) return;
  if (orch.timer) clearInterval(orch.timer);
  orchByTask.delete(taskId);
  pushTimeline(taskId, `orch> stopped${reason ? ` (${reason})` : ''}`, 'warn');
}

async function orchTick(taskId: string) {
  const orch = orchByTask.get(taskId);
  if (!orch) return;
  const stage = orch.seq[orch.idx];
  if (!stage) return;

  // timeout
  if (Date.now() - orch.stageStartedAtMs > stageTimeoutMs[stage]) {
    setTaskState(taskId, { status: 'timeout' });
    orchStop(taskId, `${stage} timeout`);
    return;
  }

  if (orch.mode === 'manual-approve') {
    if (orch.awaitingApproval) return;
  }

  if (orch.mode === 'auto-detect') {
    // only auto-detect for Verify/Review right now
    const role = stageRole(stage);
    const pane = await resolveRolePaneIndex(role);
    const log = await tmuxCapture(tmuxTarget, pane, 120).catch(() => '');
    const det = detectCompletion(stage, log);
    if (!det.done) return;

    if (det.ok) {
      pushTimeline(taskId, `orch> ${stage} detected OK`, 'ok');
    } else {
      pushTimeline(taskId, `orch> ${stage} detected FAIL -> Fix Loop`, 'warn');
      // jump to fix loop
      orch.idx = orch.seq.indexOf('Fix Loop');
      orch.stageStartedAtMs = Date.now();
      await orchSendStage(taskId, 'Fix Loop');
      orch.awaitingApproval = orch.mode === 'manual-approve';
      return;
    }
  }

  // advance
  orch.idx += 1;
  if (orch.idx >= orch.seq.length) {
    setTaskState(taskId, { status: 'done' });
    pushTimeline(taskId, 'orch> completed', 'ok');
    orchStop(taskId);
    return;
  }

  const nextStage = orch.seq[orch.idx];
  orch.stageStartedAtMs = Date.now();
  orch.awaitingApproval = orch.mode === 'manual-approve';
  await orchSendStage(taskId, nextStage);
}

app.post('/api/tasks/:id/orchestrate/start', async (req, res) => {
  const taskId = req.params.id;
  const mode = ((req.body as { mode?: OrchestratorMode }).mode ?? 'manual-approve') as OrchestratorMode;
  if (orchByTask.has(taskId)) return res.status(400).json({ error: 'already running' });

  const orch: OrchestratorState = {
    taskId,
    mode,
    seq: ['Plan', 'Exec', 'Verify', 'Review', 'Fix Loop'],
    idx: 0,
    startedAtMs: Date.now(),
    stageStartedAtMs: Date.now(),
    awaitingApproval: mode === 'manual-approve',
  };
  orchByTask.set(taskId, orch);

  try {
    await orchSendStage(taskId, orch.seq[0]);
    pushTimeline(taskId, `orch> started (${mode})`, 'ok');

    orch.timer = setInterval(() => {
      void orchTick(taskId);
    }, 2000);

    res.json({ ok: true });
  } catch (e) {
    orchStop(taskId, 'start failed');
    res.status(500).json({ error: (e as Error).message });
  }
});

app.post('/api/tasks/:id/orchestrate/approve-next', async (req, res) => {
  const taskId = req.params.id;
  const orch = orchByTask.get(taskId);
  if (!orch) return res.status(404).json({ error: 'not running' });
  orch.awaitingApproval = false;
  pushTimeline(taskId, 'orch> approved next', 'neutral');
  res.json({ ok: true });
});

app.post('/api/tasks/:id/orchestrate/stop', (req, res) => {
  orchStop(req.params.id, 'manual stop');
  res.json({ ok: true });
});

// SPA fallback for deep links
app.get(/^\/(?!api\/).*/, (_req, res) => {
  const indexHtml = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexHtml)) return res.sendFile(indexHtml);
  res.status(404).json({ error: 'not found' });
});

const server = http.createServer(app);

// WS streaming: broadcast tmux logs per role
const wss = new WebSocketServer({ server, path: '/ws' });

type WsMsg =
  | { type: 'hello'; ok: true }
  | { type: 'role_log'; role: string; text: string }
  | { type: 'error'; message: string };

function wsBroadcast(msg: WsMsg) {
  const payload = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(payload);
  }
}

const lastHashByRole: Record<string, string> = {};
let pollTimer: NodeJS.Timeout | null = null;

async function pollTmuxAndBroadcast() {
  for (const role of Object.keys(roleToPane)) {
    const pane = await resolveRolePaneIndex(role);
    try {
      const text = await tmuxCapture(tmuxTarget, pane, 220);
      const h = crypto.createHash('sha1').update(text).digest('hex');
      if (lastHashByRole[role] !== h) {
        lastHashByRole[role] = h;
        wsBroadcast({ type: 'role_log', role, text });
      }
    } catch (e) {
      wsBroadcast({ type: 'error', message: `tmux_capture_failed(${role}): ${(e as Error).message}` });
    }
  }
}

function ensurePolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    void pollTmuxAndBroadcast();
  }, 1200);
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'hello', ok: true }));
  ensurePolling();

  // On connect: send immediate snapshot
  void (async () => {
    for (const role of Object.keys(roleToPane)) {
      try {
        const pane = await resolveRolePaneIndex(role);
        const text = await tmuxCapture(tmuxTarget, pane, 220);
        ws.send(JSON.stringify({ type: 'role_log', role, text }));
      } catch {
        // ignore
      }
    }
  })();

  ws.on('message', () => {
    // ignore (reserved)
  });
});

server.listen(PORT, () => {
  console.log(`[acc-server] listening on :${PORT}`);
});
