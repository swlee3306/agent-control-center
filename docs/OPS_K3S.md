# Ops / Deployment (k3s)

This repo is commonly deployed to a single-node k3s cluster.

## Build & deploy (local tag)
If using a local image tag (e.g. `acc:dev`) with `imagePullPolicy=IfNotPresent`, **git push alone will not update the running image**.

Recommended workflow:
```bash
docker build -t acc:dev .
docker save acc:dev | sudo -n k3s ctr images import -
kubectl -n personal rollout restart deploy/acc
```

## tmux integration (codex-pool)
ACC orchestrates codex/agents via tmux.

- Session: `codex-pool`
- Socket resolution:
  - prefer `ACC_TMUX_SOCKET` if set
  - otherwise probe candidate sockets and pick the first that has session `codex-pool`

If orchestration fails to start with “no server running …”, it’s usually a socket mismatch.

## WebSocket optimization
- Server stops tmux polling when there are **0 WS clients**.
- Polling resumes on first WS client connection.

## External access gotchas
- Depending on network, the public hostname may fail from inside the same LAN (hairpin NAT / NAT loopback). Treat this as normal.
- For debugging, prefer internal access (NodePort/ClusterIP + port-forward) to reduce false alarms.
