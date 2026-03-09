# Chrome Relay (browser verification)

ACC UI verification is often done via OpenClaw **Chrome Relay**.

## Constraint
- Use **attach-only** control: the assistant can only control tabs the user explicitly attaches (Relay badge ON).

## Recovery playbook (practical)
1) `browser start(profile="chrome")` (acts like a re-sync button)
2) `browser tabs` to confirm an attached tab exists
3) If `tabs: []`:
   - toggle the OpenClaw Browser Relay toolbar icon OFF → ON on the target tab

## Health checks
- `http://127.0.0.1:18792/` should be 200 OK
- `/extension/status` should show connected state
- `/json/*` may be 401 even when things are OK (token header is required)
