# AR0339 - Review 1

- Job: 2026-10-26-review-de8e19d7
- Branch: arthur/2026-10-25-worker-4ef1fa04
- Commit reviewed: c89a9a0c90dddf89af5477872c560d9504713855
- Verdict: FAIL

## Final message

## Findings

1. **`packages/core/test/run.test.ts:16`: tests now open the real user's env file.** `const ENV = { PATH: ... }` has neither `XDG_CONFIG_HOME` nor `HOME`. Under the new default, every `arthur run` this file starts (`start`, `runOnce`) resolves `core.envFile` to `homedir()/.config/arthur/.env`, the owner's live secrets file. `checkEnv` reads it on every load (`env.ts:46`). Before this change the default sat beside the temporary config.
   - The worker added `XDG_CONFIG_HOME` to the two `spawnSync` calls in this same file (lines 200 and 259) but missed `ENV`.
   - Proof: running `cli.ts config check` under `env -i PATH=...` with strace shows `openat("/home/kacper/.config/arthur/.env", O_RDONLY)`. It is absent on this host; on a live host it would be read.
   - The review criteria fail a test that uses a production resource or path.

2. **`packages/core/src/cli.ts:115` and `packages/core/src/setup.ts:62`: two changed paths have no test.** I mutated each folder list to `() => []` and all 37 doctor, config and setup tests still pass.
   - In `cli.ts`, the list feeds `arthur doctor`'s core lines when the plugins don't load. In `setup.ts`, it feeds `arthur setup`'s fallback check.
   - Neither path's `core env` warning is exercised. That is exactly the first-install case, with a variable missing and `.env` beside the config.
   - Both mutations survive, which the criteria count as a FAIL.

3. **Doc pages printed by `--help` still describe the old default, or leave out the new check.** The criteria say a changed command updates its doc page.
   - `packages/core/docs/commands/config.md:15` (`arthur config --help`) still says "default `.env` next to the config". It now misleads the owner into the very placement this ticket removes.
   - `packages/core/docs/commands/doctor.md` (`arthur doctor --help`) has no `core env` in its example or its "What is checked" list, although the requirement is new.
   - `packages/core/docs/commands/setup.md:41` shows `Set ... in .env`. `setup.ts:76` now prints the absolute path.

## Notes

- The ticket's Done means names `~/.config/arthur/env`; the branch uses `~/.config/arthur/.env` and doesn't say why. Keeping the `.env` name does let the env guard's `NAME` pattern still catch a direct read of the file, so this looks like the better choice. It just isn't explained.
- Bypasses of the doctor check:
  - It compares paths as text (`relative(...)`), so an env file reached through a symlink into the config's folder or a project's checkout passes as `ok`. The reverse holds too: a config folder that is itself a symlink.
  - A relative `XDG_CONFIG_HOME` (the XDG spec says to ignore it) resolves inside the config's folder. Doctor does warn about that one.
  - Project paths on another machine are compared against the local path, so the worst case is a false warning.
- `README.md`, `docs/architecture/*.mmd` and the roadmap still say `.env` generically. These mentions are outside this range and don't mislead much.
- The approach follows the first of the ticket's two fixes, the smaller one: a new default, docs in `docs/setup.md` step 6, the `arthur setup` Next line, and the non-critical `core env` doctor line. The budget raise (core 6180) is recorded in `test/structure.test.ts`, and the merge kept main's budgets as the worker claims.

## Checks run

- `npm ci`: ok.
- `npm run check` (tsc): clean.
- `npm test`: 1132 tests, 1074 pass, 0 fail, 58 skipped.
- Mutations, run against doctor, config and setup tests:

| Mutation | Result |
|---|---|
| env check always ok | caught (3 fail) |
| `..` part test changed to a prefix test | caught (1) |
| host.ts without project folders | caught (1) |
| host.ts without the config folder | caught (2) |
| cli.ts folders `[]` | **not caught** |
| setup.ts folders `[]` | **not caught** |
| no `XDG_CONFIG_HOME` | caught (4) |
| `\|\|` changed to `??` | caught (1) |
| env check made critical | caught (2) |

  All files restored; `git status` is clean.
- Smoke: under `env -i PATH`, `loadConfig` resolves the default to `/home/kacper/.config/arthur/`. strace confirms the CLI opens that file.

FAIL