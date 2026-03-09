# Auth / Security

ACC can be dangerous if exposed without auth because it can orchestrate command execution via tmux.

## API token
If `ACC_API_TOKEN` is set:
- `/api/*` requires: `Authorization: Bearer <ACC_API_TOKEN>`
- `/ws` requires: `?token=<ACC_API_TOKEN>`

Web UI behavior:
- when the API responds 401, UI prompts once for token and stores it in `localStorage("acc_token")`.

## Rationale
- prevents unauthenticated remote command injection via task/orchestrator endpoints.

## Notes
- Chrome Relay endpoints under `/json/*` may return 401 by design (relay token header required). Do not treat `/json/*` 401 alone as “relay broken”.
