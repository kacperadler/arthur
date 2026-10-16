# AR0012 - Review 2

- Job: 2026-10-16-review-ar0012-job-runner-e73e1ba6
- Branch: h/2026-10-16-ar0012-job-runner-spawn-b046ca2a
- Commit reviewed: 3f6f7ddb468859a01666cc0dfae65c59e98210a5
- Verdict: PASS

## Final message

## Review: AR0012 job-runner branch, round 2 (merge commit 3f6f7dd)

**Scope checked:** the merge of `main` (AR0020 ticket board, AR0039 config-check fix) into the job-runner branch, resolving conflicts in `host.ts`, `plugin.ts`, `testing.ts`, `cli.ts`, `cli.test.ts`, `README.md`. Round 1 (job runner itself, up to 305a7a1) already PASSed and is not re-litigated.

### Findings
None.

### Verification performed

- **`host.ts`**: `checkPlugins` split kept as its own exported function; `loadPlugins` builds `jobs` via `jobRunner(...)`, passes it into every plugin's `pluginHost`, and returns `{ plugins, warnings, jobs, board }`. `LoadedPlugins` type carries both.
- **`plugin.ts`**: `Host` type has both `jobs: Jobs` and `board: Board`; `pluginHost` takes a `JobRunner` and wires both onto the host object given to each plugin.
- **`testing.ts`**: `FakeHost`/`fakeHost` comment and fields cover both `host.board` (project list via `provide("projects", …)`) and `host.jobs.spawn` (real worktree under the kit's temp root); merged without a real conflict per the commit message, and both are exercised by `testing.test.ts`.
- **`cli.ts`**: imports both `ticket-command.ts` and job types; `load()` destructures `{ plugins, jobs, board }` from `loadPlugins`; `core()` registers `config`, `ticket` (via `ticketCommand`), `run`, `spawn` (`app.jobs.spawn(request)`), `help` — both `spawn` and `ticket` present. File is 180 lines (`wc -l` confirms), under the 200-line budget; same for `host.ts` (137), `plugin.ts` (111), `testing.ts` (126).
- **`cli.test.ts`**: `CORE_LIST`/`ALL` constants list `config, help, run, spawn, ticket` and `boom, config, echo, gone, help, quiet, run, spawn, ticket` — matches worker's claim and the live `arthur help` smoke output.
- **No test lost**: recomputed the `test(` count independently per revision (correcting for root-level `test/readme.test.ts` and `test/structure.test.ts`, which my first pass's path regex excluded): base `23cc57a` → 116, main (`85d6078`) → 134 (+18), branch pre-merge (`305a7a1`) → 135 (+19), merge (`3f6f7dd`) → 153. `116+18+19=153`, matches `npm test`'s reported count exactly.
- **Mutation tests** (throwaway edits, reverted with the backup file, confirmed `git diff --stat` clean afterward):
  - Dropped `board` from the destructured `loadPlugins` result in `cli.ts` → `cli.test.ts`'s `arthur ticket all` test failed (expected `"the board is empty\n"`, got `''`). Caught.
  - Dropped `jobs` from the same destructure → `spawn.test.ts` failed with `Cannot read properties of undefined (reading 'spawn')`. Caught.
  - Both wirings are independently covered; the merge did not silently drop either side.
- **Boundaries**: `plugin.ts` importing `board.ts` is core-internal (`packages/core/src/`), no plugin-boundary violation; structure tests (`a plugin imports no other plugin, no core internal…`, `the core imports no plugin`) pass.
- **`npm ci`**: clean, 5 packages, no errors.
- **`npm run check`**: clean, no `tsc` errors.
- **`npm test`**: 153/153 pass, 0 fail, matches worker's claim.
- **Smoke test** in a fresh throwaway repo (`/tmp/ar-smoke`, removed after): `arthur help` → `commands: config, help, run, spawn, ticket`; `arthur spawn "Go."` → printed a job id (`2026-10-16-worker-493678b3`), exit 0. Matches the worker's reported smoke run.
- **README**: single changed line names both `arthur spawn` and `arthur ticket …`, `host.board` — matches claim.

### Notes
- F1 (branch named exactly `arthur` blocks a spawn) remains open per the worker's message; out of scope for this merge-resolution round, already tracked from round 1.

PASS
