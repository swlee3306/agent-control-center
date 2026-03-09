# agent-control-center (ACC)

ACC is a **one-line intent → multi-agent Plan→Exec→Verify→Review** autopilot system.

It provides a web UI + server to orchestrate a 4-role agent pipeline via tmux (codex-pool):
- roles: **architect / executor / qa / reviewer**
- default success path: **Plan → Exec → Verify → Review**
- failure-only path: **Fix Loop → Verify → Review**

## Key features
- **Autopilot** entrypoint: one-line intent, fully automatic stage advancement
- **TaskDetail “why stuck”** UX: Next/why/last_event + quick actions
- Tokened stage markers to avoid false-positive completion
- Optional **API token auth** for `/api/*` and `/ws`

More details in:
- `docs/FEATURES.md`
- `docs/AUTH_SECURITY.md`
- `docs/OPS_K3S.md`
- `docs/CHROME_RELAY.md`

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

### tmux integration
- Session: `codex-pool`
- Socket: set `ACC_TMUX_SOCKET` if you have a non-standard tmux socket path.
  - ACC also supports lazy socket discovery (probes candidates and finds the socket that owns `codex-pool`).

## Deploy (k3s)

A minimal manifest is in `k8s/`.

For reliable deploys with a local image tag (k3s containerd), see `docs/OPS_K3S.md`.
