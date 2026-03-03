# agent-control-center

Web UI to view and control a 4-role agent pipeline (**architect / executor / qa / reviewer**) with a stage loop (**Plan → Exec → Verify → Review → Fix Loop**).

## Dev

Prereqs: Node 20+.

```bash
npm install
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:8787

## Notes

- Design source: `Agent_Control_Center.pen`
- tmux integration (optional at runtime): set
  - `ACC_TMUX_SOCKET=/tmp/openclaw-tmux-sockets/openclaw.sock`
  - `ACC_TMUX_SESSION=codex-pool`

## Deploy (k3s)

A minimal manifest is in `k8s/`.
