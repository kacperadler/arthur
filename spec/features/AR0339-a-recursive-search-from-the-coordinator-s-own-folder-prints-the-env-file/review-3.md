# AR0339 - Review 3

- Job: 2026-10-26-review-f76609a0
- Branch: arthur/2026-10-25-worker-4ef1fa04
- Commit reviewed: 6e12c71c63d2848bed7f55fb3bfaeae5272e5e61
- Verdict: FAIL

## Final message

The branch can't be merged yet: the merge of main brought in a test that, with this branch's new default, makes `npm test` open the owner's live secrets file. Everything else review 2 passed still holds, including the parts of the merge I re-checked.

## Findings

1. **`packages/core/test/cli.test.ts:360`, made reachable by `packages/core/src/config.ts:109`: a test opens the owner's real env file.**
   - **Where it came from:** the merge in `6e12c71c` brought in main's test "in a job's scope the CLI refuses with ARTHUR_JOB cleared…" (from `48208a6b`, AR0354). It starts the CLI with `env: { PATH: process.env.PATH ?? "" }` only, without the `XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME` the worker added to every other bare-env spawn.
   - **What happens:** with this branch's default, that child process resolves `core.envFile` to `homedir()/.config/arthur/.env`, and `checkEnv` reads it on every load (`env.ts:46`).
   - **When it runs:** the test is skipped outside a job's systemd scope, so it runs exactly when an Arthur job runs `npm test`, which is the normal case on the owner's host.
   - **Why it matters now:** under the 2026-10-26 Decision, the owner has already put the file there. `/home/kacper/.config/arthur/` holds a `-rw-------` env file.
   - **Proof:** I traced `openat` under `strace -f` for that test alone and got 4 opens of that path (`openat(AT_FDCWD, "/home/kacper/.config/arthur/.env", O_RDONLY|O_CLOEXEC) = 17`). The full `npm test` under the same trace shows the same 4 opens and no others.
   - **Criteria:** a test that uses a production path fails the branch. It is the same failure as review 1's finding 1, brought back by the merge.
   - **Fix:** pass `XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME` in that spawn's `env`.

## Notes

- **Review 2's notes still apply.** The ticket says `~/.config/arthur/env` but the branch uses `.env`, still with no reason given; keeping `.env` lets the env guard still catch a direct read by name. The doctor check compares paths as text, so a symlink into a checkout reads `ok`. A relative `XDG_CONFIG_HOME` gets the warning, but its fix text doesn't name the real cause.
- **Merge resolution:** `cli.ts` keeps `import { dirname } from "node:path"` because the `core env` fallback uses it. Core's budget is now 6197 = main's 6184 + 13, recorded in `test/structure.test.ts`, with main's other budgets kept. The structure test passes, which matches the worker's account.

## Checks run

- `npm ci`: ok (22 packages).
- `npm run check`: tsc clean.
- `npm test` (under `strace -f --seccomp-bpf -e trace=openat`): exit 0, 1150 tests, 1092 pass, 0 fail, 58 skipped. That matches the worker's figures. The trace shows 4 opens of `/home/kacper/.config/arthur/.env`, all from the test in finding 1.
- Mutations, each restored with `git checkout --`; `git status` was clean afterwards:

| Mutation | Tests run | Result |
|---|---|---|
| `cli.ts:116` folders → `() => []` (the merge-touched line) | doctor | caught: 12 pass, 1 fail |
| `requirements.ts` `split(sep)[0] !== ".."` → `=== ".."` | doctor, setup | caught: 8 pass, 17 fail |

FAIL