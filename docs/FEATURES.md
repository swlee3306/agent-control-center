# ACC features (Agent Control Center)

ACC is a web UI + server that orchestrates a **4-role agent pipeline** using tmux panes (codex-pool):
- roles: `architect`, `executor`, `qa`, `reviewer`
- default success path: **Plan → Exec → Verify → Review**
- failure-only path: **Fix Loop → Verify → Review** (only when a stage fails)

## One-line intent UX
- Dashboard supports a one-line **intent** input and a single button to run autopilot.
- Autopilot automatically advances stages (no manual “approve next”).

## Autopilot API
- `POST /api/autopilot/run`
  - body: `{ intent: string, maxFixLoops?: number }`
  - creates a task and starts orchestration.

## Task & Orchestrator status
- `GET /api/tasks/:id` includes:
  - `stage` (current stage)
  - `orch` (orchestrator state: mode/currentStage/seq/idx/fixLoops/retries/waiting/timeout/lastCapture/lastMarker)

## UI improvements
- Dashboard:
  - new-task modal (required vs optional fields)
  - intent examples (chips)
  - fix-loops selector
  - empty-state UX
  - fast preview (confirm) before running
  - cleanup_done (bulk delete non-running)

- TaskDetail:
  - `// STATUS` panel: **Next / why-stuck / last_event**
  - quick actions: **JUMP_TO_LOG**, RETRY STAGE, STOP ORCH, TERMINATE
  - jump-to-console: `OPEN @<role>`
  - DONE/IDLE actions: CLEANUP (terminate→delete), DELETE
  - timeline filters (ok/warn/neutral) + jump to last_warn

- Agent Console:
  - SUMMARY strip + last_event + CTAs (refresh/jump/open task)

## Marker-based stage completion
- Uses tokened stage markers to avoid false positives from historical tmux output:
  - `ACC_PLAN_OK::<token>`
  - `ACC_EXEC_OK::<token>`
  - `ACC_VERIFY_OK::<token>`
  - `ACC_REVIEW_OK::<token>`

Important reliability rule:
- Do **not** include the full tokened marker string in prompts (only a prefix + separate token guidance), otherwise it can be accidentally echoed and falsely matched.
