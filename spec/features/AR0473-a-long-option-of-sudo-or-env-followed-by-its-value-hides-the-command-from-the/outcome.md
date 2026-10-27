# AR0473 - Outcome

- Merged: 2026-10-27, `e8f33db6`
- Branch: arthur/2026-10-27-worker-67871c96
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $1.96, reviews n/a; review rounds 2

## What went in

- `packages/core/src/worktree-guard.ts`: `WRAPPERS` lists every long option of `sudo` (from sudo's `parse_args.c`) and of `env` (from coreutils' `env.c`, `--env0-from` and `--quoting-style` included), with `=` after those that take a value, and the missing short ones (`sudo -a -c -r -t`, `env -a`). `commandIndex` resolves a `--` word as getopt_long does: only when exactly one listed option starts with it, and that option skips the next word only if it takes a value written without `=`. So `sudo --user root rm <main>/README.md` and `env --unset X rm …` are judged on the `rm`. A comment names the sources and that an option newer than them is missing.
- `packages/core/test/worktree-guard.test.ts`: a row for each value-taking long option of sudo, prefixes (`--us`, `--u`, `--e`, `--q`), `--login` (no value though `--login-class` takes one), the `=` forms, and the new short ones, each refused naming the main checkout.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1139/1206 passed.

## Left open

- Tickets from findings: AR0497 (F1, the other wrappers' long options), AR0498 (F2, `env -S`).
- Review notes F3, F4: settled in findings.md.
