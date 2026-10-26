# AR0339 - Review 4

- Job: 2026-10-26-review-0db64730
- Branch: arthur/2026-10-25-worker-4ef1fa04
- Commit reviewed: 6853eeda6e9efe00fbf914b55efdf76983504ed7
- Verdict: PASS

## Final message

No blocking findings. The branch moves the default env file out of the coordinator's folder and makes `arthur doctor` warn when it sits inside a folder an agent works in. That is the first of the ticket's two fixes, with docs and tests. The core budget of 6197 matches AR-D48.

**Findings**

None that block the merge.

**Notes**

- `packages/core/src/config.ts:109`: the default is `~/.config/arthur/.env`, but the ticket says `~/.config/arthur/env`. The worker's final message gives the reason: with the `.env` name, the env guard still refuses a tool call that names the file directly. My own mutation command was refused by that guard, which confirms it. AR-D45 only says "in ~/.config/arthur", so this does not contradict a Decision.
- `packages/core/src/requirements.ts:91`: the containment check compares paths as text (`relative(...).split(sep)[0] !== ".."`). An env file reached through a symlink into a checkout reads `ok`. Review 2 already noted this.
- `packages/core/src/requirements.ts:95`: the fix text always says `~/.config/arthur/.env`. When `XDG_CONFIG_HOME` is set, the real default is `$XDG_CONFIG_HOME/arthur/.env`, so the advice is slightly wrong there.
- `packages/core/test/cli.test.ts:34,316,331,360`: when `process.env.XDG_CONFIG_HOME` is undefined, the CLI gets it unset rather than empty. The test kit always sets it, so this has no effect in practice.

**Checks run**

- `npm ci`: 22 packages added.
- `npm run check`: `tsc` clean.
- Every test file the branch changes, in foreground batches, all 0 fail:
  - `doctor`, `config`, `setup`, `config-check` (core), plus `test/structure.test.ts` and `test/readme.test.ts`: 63 pass.
  - `cli`, `job-records`, `model`, `roles`, `spawn`: 81 pass.
  - `job-control`: 26 pass, 2 skipped.
  - findings `findings-command`, orchestration `board-commands`, `context` and `decisions`, session `session`: 69 pass.
  - `run.test.ts` and `test/job-gate.test.ts`: 12 pass.
- I did not run the full `npm test`, as you instructed.
- Mutations, one at a time, each restored with `git checkout`; the tree is clean afterwards. Every one was caught:
  - `config.ts`: `XDG_CONFIG_HOME ||` changed to `??`. Failed "every default filled" in `config.test.ts`.
  - `requirements.ts`: the inside check inverted (`!== ".."` → `=== "nope"`). Failed 3 env tests in `doctor.test.ts`.
  - `host.ts`: project checkouts dropped from the folder list. Failed "by default lies outside" in `doctor.test.ts`.
  - `cli.ts`: config folder dropped from the folder list the CLI passes to `coreRequirements` when the plugins do not load. Failed "while the load refuses" in `doctor.test.ts`.
  - `setup.ts`: config folder dropped from the folder list. Failed "a config whose load refuses…" in `setup.test.ts`.

PASS