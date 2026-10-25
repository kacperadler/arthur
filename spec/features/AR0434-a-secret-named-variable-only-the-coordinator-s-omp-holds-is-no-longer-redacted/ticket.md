# AR0434 - A secret-named variable only the coordinator's omp holds is no longer redacted by name

```json
{
  "id": "AR0434",
  "title": "A secret-named variable only the coordinator's omp holds is no longer redacted by name",
  "date": "2026-10-25"
}
```

## Description

F1 of AR0428 (spec/features/AR0428-redaction-runs-twice-on-two-paths-so-the-extensions-rewrite-part-of-an-env-file/findings.md).

- Kind: security
- Found by: 2026-10-25-worker-de062520 (worker), 2026-10-25
- Where: `packages/orchestration/src/inbox-extension.ts:116`, `packages/session/src/turn-extension.ts:43`
- What: the extensions no longer redact (AR0428), so the by-name rule (`KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH`) now reads `arthur run`'s environment, not omp's. omp runs in a tmux session whose environment is the tmux server's global one plus the `-e` variables (`packages/orchestration/src/coordinator.ts:116`); a variable set only there (a tmux server started earlier from another shell) is no longer matched by value. [INFERENCE] not reproduced; the shape rules (vendor prefix, 20+ mixed runs, `Bearer`) still apply, so only a short value of an unusual shape would pass.
- Suggestion: start the coordinator's tmux session with `arthur run`'s environment only, so both sides hold the same values; not by writing omp's own secret-named values to disk next to the error. Out: the extensions' raw copies, which stay in the 0700 home.

## Goal

The coordinator's tmux session holds only `arthur run`'s environment, so the redaction by name reads the same values omp sees; tested.

- Kind: security

## Done means

- `packages/orchestration/src/coordinator.ts:116` starts the session so that a variable set only in the tmux server's global environment is not in omp's (for example `tmux new-session` with `env -i` and `arthur run`'s own variables, or the server's global environment cleared of names `arthur run` does not hold). Test: a tmux server holding `ARTHUR_TEST_TOKEN=short-val` globally, the coordinator started, and its pane's environment does not hold it. It fails on main.
- `npm test` and `npm run check` pass; orchestration's budget may be raised by the lines needed (AR-D29).

## Scope

In:
- `packages/orchestration/src/coordinator.ts`, its test.

Out:
- The extensions' raw copies in the 0700 home.

## Decisions

- 2026-10-25: Source: F1 of AR0428
- 2026-10-25: AR0434 approved under AR-D31, group 2; the owner: "always go with recommendation till the 8 am morning" (AR-D40)
