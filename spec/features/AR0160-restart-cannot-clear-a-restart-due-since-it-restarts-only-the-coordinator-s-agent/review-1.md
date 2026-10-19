# AR0160 - Review 1

- Job: 2026-10-19-review-ar0160-restart-cl-00e8ca8e
- Branch: h/2026-10-19-ar0160-restart-clears-re-0903b6ec
- Commit reviewed: 9d7eab54b6cb37a1bb4ae58445a13819e73251da
- Verdict: PASS

## Final message

## Review: AR0160 — `/restart` clears a restart due

### Findings
None that block merge.

### Notes (non-blocking)
- `packages/core/test/scope.test.ts:246` ("a job over its memory cap…") failed once in the full-suite run (`timed out waiting for … end`) but passed cleanly in isolation (15/15). File is untouched by this diff (`git diff … -- packages/core` is empty) — pre-existing resource-contention flake under full-suite parallel load, not a regression from this branch.
- No dedicated test explicitly exercises "nightly fresh start never ends `arthur run`" with a service present; verified instead by code inspection — the byNight `Request` built at `restart.ts:179` never sets `run`, so it is structurally unreachable (only the `/restart`-built `Request` at line 66 sets `run`). Acceptable given the invariant is enforced by construction, not by a runtime branch that could silently flip.

### Checks run (in this worktree, against `392ea44a..9d7eab54`)
- `npm ci`: ok.
- `npm run check` (`tsc`): passes, no errors.
- `npm test`: 570 tests, 569 pass, 1 unrelated flake (see Notes); isolated rerun of the flaking file: 15/15 pass.
- `wc -l packages/session/src/*.ts` = 818, matches the raised `BUDGETS.session = 818` in `test/structure.test.ts`; every individual file ≤200 lines.
- Traced `process.kill(process.pid, "SIGTERM")` into `packages/core/src/run.ts`: `SIGTERM`/`SIGINT` are run.ts's own normal stop signals (`process.on(name, signal)`), so self-SIGTERM triggers the standard plugin-stop sequence, same as the service's own stop — matches the worker's claim.
- Traced the restart race window: `coordinator.ts`'s `supervise` loop only attempts a respawn after `restartDelaySeconds` (default 5 s) elapses, and `stop()` aborts the pending sleep immediately; `arthur run`'s own shutdown (triggered right after `coordinator.restart`) completes well inside that 5 s window, so no duplicate-coordinator race from the added self-SIGTERM.
- Mutation testing (throwaway edits, reverted with `git checkout -- <file>` each time, confirmed clean via `git status --porcelain`):
  - Dropped `Restart === "always"` check in `noteService` → test `"an arthur run that is not the service's, or a service without Restart=always, restarts only the coordinator…"` failed as expected (wrong reply text).
  - Dropped the `servicePid(host.folder) === process.pid` guard on the tick's `run` flag → same test failed differently (unexpected `Restarted. (arthur run restarted; …)` and a spurious SIGTERM), confirming a stale/hand-written `run:true` request is still rejected when this process isn't the service's main pid.
  - Disabled the `restartGuard === false` early return in `due()` → test `"under the service, /restart with no restart due, or with restartGuard: false, restarts only the coordinator"` failed (reply wrongly claimed a restart was due from a broken `loaded.json` left over from guard-off).
  - All three mutations were caught; files restored and verified clean afterward.
- Spot-checked docs (`restart.md`, `session.md`, `docs/deploy.md`, `README.md`, `arthur.config.example.ts`) against the new behavior: consistent, step 6 added, notice wording matches code.
- Confirmed no boundary violations: session package only imports its own files + `@arthur/core` types; `SERVICE` file lives under the session plugin's own `<home>/session/` folder, removed on `stop()`; no cross-plugin reads/writes.
- Confirmed test fixtures use a temp git checkout (`temporaryFolder()`) and a fake `systemctl` shim prepended to `PATH` — no real systemd unit created/started, no production resource names reused; `job()` helper uses `project: "acme"` (no real client name).

PASS
