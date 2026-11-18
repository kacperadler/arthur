# AR0723 - Outcome

- Merged: 2026-11-18, `6c9abe65`
- Branch: arthur/2026-11-18-worker-5df5d69b
- Reviews: review-1.md PASS
- Cost: worker $6.05, reviews $0.41; review rounds 1

## What went in

- packages/delivery/test/fake-npm.ts: writes a fake `npm` into a folder that runs the named script of package.json with `exec sh -c` after npm's two lines, and notes each call. Traced `npm test`, before on 4fdb2c69 and after on 9aaf7a7f: real npm processes 154 to 30, their CPU 32.6 s to 9.0 s, plus about 4.4 CPU-s for the fake's 134 calls.
- packages/delivery/test/fake-npm.test.ts: holds the fake against real npm (5 real starts): the same output, exit status, death by a signal, arguments after `--`, and a SIGTERM while the script runs.
- packages/delivery/test/merge-setup.ts: the shared merge setup puts the fake `npm` beside the fake `bun` on the PATH the merge's steps get, and returns `npm()`, its calls.
- packages/delivery/test/auto-merge.test.ts: its own setup puts the fake `npm` on PATH (16 real starts to 0); the first test asserts the checks ran through it.
- packages/delivery/test/merge.test.ts: the first test asserts the checks ran through the fake npm, once each (35 real starts to 0).
- packages/delivery/test/merge-steps.test.ts: the `nvm.path` test stays on real npm, on the PATH the file started with, and asserts the fake ran nothing (18 real starts to 4); the step-limit comment names the fake.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1839/1910 passed.

## Left open

- Findings: none; no findings.md on this ticket.
