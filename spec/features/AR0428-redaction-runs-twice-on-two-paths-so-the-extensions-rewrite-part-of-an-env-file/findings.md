# AR0428 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A secret-named variable only the coordinator's omp holds is no longer redacted by name

- Kind: security
- Found by: 2026-10-25-worker-de062520 (worker), 2026-10-25
- Where: `packages/orchestration/src/inbox-extension.ts:116`, `packages/session/src/turn-extension.ts:43`
- What: the extensions no longer redact (AR0428), so the by-name rule (`KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH`) now reads `arthur run`'s environment, not omp's. omp runs in a tmux session whose environment is the tmux server's global one plus the `-e` variables (`packages/orchestration/src/coordinator.ts:116`); a variable set only there (a tmux server started earlier from another shell) is no longer matched by value. [INFERENCE] not reproduced; the shape rules (vendor prefix, 20+ mixed runs, `Bearer`) still apply, so only a short value of an unusual shape would pass.
- Suggestion: start the coordinator's tmux session with `arthur run`'s environment only, so both sides hold the same values; not by writing omp's own secret-named values to disk next to the error. Out: the extensions' raw copies, which stay in the 0700 home.
- Status: open
