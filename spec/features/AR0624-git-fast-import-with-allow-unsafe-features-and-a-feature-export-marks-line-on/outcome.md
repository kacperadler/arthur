# AR0624 - Outcome

- Merged: 2026-11-05, `47c9c31b`
- Branch: arthur/2026-11-05-worker-e5e58c0b
- Reviews: review-1.md PASS
- Cost: worker $0.89, reviews $0.55; review rounds 1

## What went in

- packages/core/src/bash-refusal.ts: refuses `git fast-import` with `--allow-unsafe-features` on any repository, since stdin's `feature export-marks=<path>` can then write any file.
- packages/core/test/worktree-guard.test.ts: rows showing that piped stdin, a redirect and an alias given by `-c` carrying the flag are refused into main, plus the refusal message.
- docs/deploy.md: says `git fast-import --allow-unsafe-features` is refused on any repository, and why.
- spec/features/AR0624-git-fast-import-with-allow-unsafe-features-and-a-feature-export-marks-line-on/findings.md: F1, stdin `option git export-pack-edges=` appends to any file without the unsafe flag.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1479/1550 passed.

## Left open

- Deferred (client summary): F1. git fast-import appends to any file named by a stdin `option git export-pack-edges=` line, without --allow-unsafe-features
- Deferred (client summary): F2. the flag set at run time passes
- Deferred (client summary): F3. F1 is a real remaining hole
