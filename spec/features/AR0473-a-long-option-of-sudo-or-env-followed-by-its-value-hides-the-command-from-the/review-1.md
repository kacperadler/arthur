# AR0473 - Review 1

- Job: 2026-10-27-review-6bbfa971
- Branch: arthur/2026-10-27-worker-67871c96
- Commit reviewed: 9818606f8dd0d1d5d64603fdbc20876cbe9bd8a5
- Verdict: FAIL

## Final message

I'm failing this branch: the guard still misses one of env's long options that takes a value, so a command can be hidden from it the way the ticket describes.

## Findings

1. **`packages/core/src/worktree-guard.ts:20`: env's list of long options is missing `--env0-from=`.** It is a long option of GNU env that takes a value. It shipped in coreutils 9.12 (stable, 2026-09-14), where coreutils' current `src/env.c` lists it as `{"env0-from", required_argument, …}`. Without it, `env --env0-from X rm <main>/README.md` passes the guard. I confirmed this by adding that line as a test row in `worktree-guard.test.ts`. It failed with `actual: undefined, expected: 'the main checkout'`, and I then removed the row. The prefix `--e`, which only `--env0-from` starts with, is not covered either.

   This breaks the Done means point "the other long options of sudo and env that take a value are skipped with it". The comment on line 19 is also wrong where it says "the long options of sudo and env are all there". The worker added `--argv0` because newer envs have it, but missed this newer option. The env installed here is 9.4, so the hole is open only on coreutils 9.12 or later. The ticket is a security ticket, so that still counts.

## What you asked me to judge

- **Prefix resolution like getopt_long: correct.**
  - A word starting with `--` resolves only when exactly one listed option starts with it. That option skips the next word only if it ends in `=` and the word has no `=`.
  - Where several options match, glibc gives an ambiguity error, so the command never runs, and the guard skipping nothing is safe. Examples: `--r`, and `--a` for sudo.
  - A whole option name is never a prefix of another option that takes a value. So `--login` being matched by two options (`--login` and `--login-class=`) still ends in the right answer, no value. Every option with an optional argument is listed without `=`, which matches getopt_long: an optional value is only ever read after `=`. These are `--preserve-env[=list]` and `--block-signal`, `--default-signal`, `--ignore-signal` `[=SIG]`.
  - The sudo list matches sudo's `sudo_long_opts` in `src/parse_args.c` on `main` exactly: 31 options, and `required_argument` maps to `=` each time.
- **The new short options: correct.** sudo's `sudo_short_opts` is `"+Aa:BbC:c:D:Eeg:Hh::iKklNnPp:R:r:SsT:t:U:u:Vv"`, so `-a`, `-c`, `-r` and `-t` take a value. env's short options are `"+a:C:iS:u:v0…"`, so `-a` takes a value.
- **`env --argv0`: correct.** coreutils' `env.c` has `{"argv0", required_argument, NULL, 'a'}`. Its NEWS lists it under 9.5 (2024-03-28): "env now accepts the -a,--argv0 option". On envs older than 9.5 the option is unknown and env exits with an error, so listing it only refuses more there.

## Notes (not blocking)

- coreutils master adds `--quoting-style=WORD` (required argument) to env, but it is not released yet. Once it ships it opens the same hole.
- The code reads an exact name like `--login` as ambiguous rather than as an exact match, as getopt_long does. That is only safe because no whole option name is a prefix of another option that takes a value, which line 19 documents. A future option breaking that rule would quietly change the result.

## Checks run

- `npm run check` (tsc): no errors.
- `node --test packages/core/test/worktree-guard.test.ts`: 11 tests, 11 pass, 0 fail, 0 skipped.
- Full `npm test` on the host, as the coordinator reported it: 1204 tests, 1198 pass, 0 fail, 6 skipped. As you asked, I did not run it here.
- `worktree-guard.ts` is 200 lines, within the limit.
- Mutations, each run against `worktree-guard.test.ts`. Every one gave 1 fail, so the tests catch all of them, and each was put back with `git checkout`:
  - `options.length === 1` → `>= 1`
  - `--argv0=` removed
  - env `-a` removed
  - sudo `-a -c -r -t` removed
  - `&& long[2] === ""` dropped
  - `option?.endsWith("=") === true` → `option !== undefined`
  - `--user=` removed
  - `--login-class=` removed
  - `--other-user=` removed
- Probe for `env --env0-from X rm <main>/README.md`: not refused (finding 1). The row was removed afterwards, and `git status` is clean.

FAIL