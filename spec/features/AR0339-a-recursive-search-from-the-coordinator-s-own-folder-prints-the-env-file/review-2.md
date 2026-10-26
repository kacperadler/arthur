# AR0339 - Review 2

- Job: 2026-10-26-review-ee92beaa
- Branch: arthur/2026-10-25-worker-4ef1fa04
- Commit reviewed: 8ad95693655378a33556c2b7d9321923e9995ce2
- Verdict: PASS

## Final message

The branch can be merged. Commit `8ad95693` fixes all three findings from review 1, and I found nothing new that blocks it.

## Findings

None.

Review 1's findings are fixed:

1. **Tests no longer reach the real env file.** In `packages/core/test/run.test.ts:16`, `ENV` now passes on the test kit's `XDG_CONFIG_HOME`, and `test/job-gate.test.ts:38` sets one inside its temp folder. No other test starts `arthur` with a bare env object that leaves it out; `test/readme.test.ts:28` already passes it on. I traced seven test files with strace (`openat`, `stat`, `statx`, `access`; 65 pass, 224,638 trace lines). None of them touched `/home/kacper/.config/arthur`.
2. **The doctor and setup fallback paths now have tests.** The new tests in `doctor.test.ts:199` and `setup.test.ts:203` catch both mutations from review 1, at `cli.ts:115` and `setup.ts:62`.
3. **The `--help` pages are updated.** `config.md:15` gives the new default. `doctor.md` has `core env: ok` in its example and a `core env` entry under "What is checked". `setup.md:41` shows the full env file path.

## Notes

- **File name:** the ticket names `~/.config/arthur/env`; the branch uses `~/.config/arthur/.env`, and the final message still doesn't say why. Keeping `.env` lets the env guard still catch a direct read by name, so it is the better choice; it just isn't explained.
- **Relative `XDG_CONFIG_HOME`:** the file then resolves inside the config's folder. I tried `XDG_CONFIG_HOME=rel`: doctor warns, but its fix text, "move it to ~/.config/arthur/.env", doesn't name the real cause.
- **Symlinks:** the doctor check compares paths as text, so an env file reached through a symlink into a checkout still reads `ok`. Review 1 noted this; it doesn't block.
- **Existing installs:** an install whose `.env` sits beside the config must move it before its next start. `docs/setup.md` step 6 says so; the owner should act on it before deploying.
- **Line budget:** the raise to 6180 is recorded in `test/structure.test.ts` under AR-D29, as earlier raises were.

## Checks run

- `npm ci`: ok.
- `npm run check`: clean.
- `npm test`: 1134 tests, 1076 pass, 0 fail, 58 skipped.

Mutations, each restored with `git checkout --`; `git status` is clean afterwards:

| Mutation | Tests run | Result |
|---|---|---|
| `cli.ts:115` folders → `() => []` | doctor | caught: 12 pass, 1 fail (matches the worker's claim) |
| `setup.ts:62` folders → `() => []` | setup | caught: 11 pass, 1 fail (matches the worker's claim) |
| env check always `ok` | doctor, config, setup | caught: 5 fail |
| `split(sep)[0] !== ".."` → `startsWith("..") === false` | doctor, config, setup | caught: 1 fail |
| `host.ts:70` without the project folders | doctor, config, setup | caught: 1 fail |
| `config.ts:109` without `XDG_CONFIG_HOME` | doctor, config, setup | caught: 4 fail |

Smoke test with `cli.ts doctor` under `env -i` and a temp `HOME`/`XDG_CONFIG_HOME`:
- Default env file: `core env: ok`.
- `envFile: "sub/../vars"`: `core env: missing: the env file <cfg>/vars lies inside <cfg>; …`.
- `XDG_CONFIG_HOME=rel`: `missing … <cfg>/rel/arthur/.env lies inside <cfg>`.

PASS