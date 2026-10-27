# AR0519 - Review 1

- Job: 2026-10-27-review-db16055e
- Branch: arthur/2026-10-27-worker-7ea85a74
- Commit reviewed: 7254e6c27b59ab4f21cb8d4cd9ef29c3b4129aa7
- Verdict: PASS

## Final message

I found no blocking problems. The branch does what AR0519 asks: the guard no longer refuses `process\.env` in a regex, and it still refuses every way of naming the real secrets file.

**Findings**

None blocking.

**What I checked in the change**
- **The match** (`packages/core/src/env-refusal.ts:13`): the start of the `NAME` pattern is now `(?<![\w.]\\*)`, so `.env` right after a name and some backslashes no longer counts as a file name. In bash, a backslash after a name joins that name to `.env`: `x\.env` becomes `x.env` and `x\\.env` becomes `x\.env`. A line break works the same way, so `x\<newline>.env` becomes `x.env`. In eval code, `\.` either becomes `.` or stays a literal backslash. So no input in this form can name the real `.env`, and the change opens no way around the guard.
- **Ways round it I tried** (a throwaway script calling `envRefusal` with cwd `/tmp`, never a real file):
  - Still refused: `cat \.env`, `./\.env`, `~/\.env`, `"$HOME"/\.env`, `a\/\.env`, `$D\/\.env`, `${DIR}\.env`, `-- \.env`, `<\.env`, `x\ \.env`, `source \.env`, `\.mcp.json`, read `dir/\.env` and read `\.env`.
  - Bash `cat $DIR\\.env`, `grep -e"process\.env"`, and eval `"\x2f\.env"`, `"\57\.env"`, `"\u002f\.env"`, `"x/" + "\.env"` and `` `${d}\.env` `` are also still refused. The eval forms are caught because the guard decodes the escapes first.
  - Allowed, correctly: `cat x\.env`, `cat .\.env` (the shell reads `..env`), `cat $D/x\\.env`, `cat x\.mcp.json`, `awk "/process\.env/"` and grep path `x\.env`. None of these names the secrets file.
- **The ticket's evidence case:** the coordinator's `grep -iE 'process\\.env\\.[A-Z_]+' -r src` is a test row, as are `sed`, `rg` and an eval regex. The new refused rows check the exact name the refusal prints.
- **Files:** `env-refusal.ts` is 118 lines and the test file 140, under the 200-line limit. The core still fits its line budget (the structure tests pass). No new imports, dependencies or classes.

**Notes (not blocking)**
- The second commit's scope is `core`, not the ticket id (`fix(core): keep the env guard's comments within the core budget`). The first commit names AR0519 only in its subject.
- The worker's finding F1 is accurate: `packages/delivery/src/review-needed.ts:15` has `DOT_ENV = /(?<!\w)\.env\b/`, which would also match `process\.env`. It is outside this ticket and is listed as open in `findings.md`.
- Unchanged by this branch: `cat ${DIR}\.env`, `grep -e'process\.env'` and `x\<newline>.env` are still refused even though none of them names the secrets file.

**Checks run**
- `npm ci`: ok.
- `npm run check` (tsc): passed.
- `npm test`: 1223 tests, 1162 pass, 0 fail, 0 cancelled, 61 skipped. This matches the worker's numbers.
- `node --import @arthur/core/testing --test packages/core/test/env-guard.test.ts test/structure.test.ts packages/develop/test/plugin-new.test.ts`: 25 pass, 0 fail.
- Mutations, each run against `env-guard.test.ts` and then undone with `git checkout -- packages/core/src/env-refusal.ts`:
  - Back to the old `(?<![\w.])`: the table test fails.
  - `\\*` changed to `\\?`: fails on the coordinator's `process\\.env` row.
  - `\\*` changed to `\\+`: fails on `process.env.HOME`.
  - A backslash added to the class, `(?<![\w.\\]\\*)`: fails on `cat \.env` because the printed name changes.
- The checkout is clean at `7254e6c27b59ab4f21cb8d4cd9ef29c3b4129aa7`.

PASS