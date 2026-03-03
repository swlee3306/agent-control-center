import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
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

// WS for future streaming. For now, echo.
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'hello', ok: true }));
  ws.on('message', () => {
    ws.send(JSON.stringify({ type: 'pong' }));
  });
});

server.listen(PORT, () => {
  console.log(`[acc-server] listening on :${PORT}`);
});
