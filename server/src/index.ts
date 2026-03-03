import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { listTasks, getTaskDetail, pushTimeline } from './store.js';
import { tmuxCapture, tmuxSend, type TmuxTarget } from './tmux.js';

const PORT = Number(process.env.PORT ?? 8787);

const ACC_TMUX_SOCKET = process.env.ACC_TMUX_SOCKET ?? '/tmp/openclaw-tmux-sockets/openclaw.sock';
const ACC_TMUX_SESSION = process.env.ACC_TMUX_SESSION ?? 'codex-pool';

const tmuxTarget: TmuxTarget = { socket: ACC_TMUX_SOCKET, session: ACC_TMUX_SESSION };

const roleToPane: Record<string, number> = {
  architect: 0,
  executor: 1,
  qa: 2,
  reviewer: 3,
};

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

  const pane = role ? roleToPane[role] : undefined;
  const targetPane = pane ?? roleToPane.executor; // default executor

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
  const targetPane = roleToPane[tpl.role];
  pushTimeline(req.params.id, `stage>${stage} -> @${tpl.role}`, 'neutral');

  try {
    // Always run via codex so stage buttons work even when the pane is just a shell.
    const cmd = `codex --yolo ${bashDollarString(tpl.text)}`;
    await tmuxSend(tmuxTarget, targetPane, cmd);
    res.json({ ok: true });
  } catch (e) {
    pushTimeline(req.params.id, `stage_failed: ${(e as Error).message}`, 'warn');
    res.status(500).json({ error: 'stage failed' });
  }
});

app.get('/api/tmux/:role/log', async (req, res) => {
  const pane = roleToPane[req.params.role];
  if (pane === undefined) return res.status(404).json({ error: 'unknown role' });
  const lines = Math.max(20, Math.min(2000, Number(req.query.lines ?? 200)));

  try {
    const text = await tmuxCapture(tmuxTarget, pane, lines);
    res.json({ role: req.params.role, text });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
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
    const pane = roleToPane[role];
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
        const text = await tmuxCapture(tmuxTarget, roleToPane[role], 220);
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
