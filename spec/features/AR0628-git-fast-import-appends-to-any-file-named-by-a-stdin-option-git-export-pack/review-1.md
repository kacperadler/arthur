# AR0628 - Review 1

- Job: 2026-11-06-review-eaea6382
- Branch: arthur/2026-11-06-worker-63366938
- Commit reviewed: 0c6002316f3494d195b4a901b01b93023cf7b5d9
- Verdict: PASS

## Final message

I found no blocking issues. The branch meets each "Done means" point in AR0628.

- **The refusal.** `packages/core/src/bash-refusal.ts:40` sets `fed` when any text the guard parses contains `|`, `<` or `>(`. Line 129 then refuses `git fast-import` on any repository. I called `bashRefusal` directly to check the edge cases:
  - Refused: `printf x | git -C /tmp/other fast-import`, `exec 3<notes; git -C /tmp/other fast-import` and `git -C /tmp/other fast-import <&-`.
  - Still allowed: a plain `git -C /tmp/other fast-import` and `… fast-import 2>&1 >out`. The ticket keeps that case open.
  - Refused through the existing operand check: the command-line forms `--export-pack-edges=<main>/x` and `--export-marks=<main>/x`.
- **The test fails when the refusal is removed.** I made two hand mutations in `bash-refusal.ts` and ran `worktree-guard.test.ts` alone after each. Both were caught (16 pass, 1 fail each time), and I restored the file with `git checkout`; `git status` was clean afterwards.
  - Removing `fed ||` at line 129.
  - Removing `<` from the `fed` regex.
- **Docs.** `docs/deploy.md:44` describes the new rule. A search of `docs`, `README.md` and `spec/roadmap.md` found no other mention of fast-import that is now out of date.
- **Budget and file size.** The core budget goes from 7238 to 7239, as recorded in AR-D513. `bash-refusal.ts` grows from 211 to 212 lines and stays yellow; the worker's final message gives the reason.
- **Worker's claims.** They match what I saw. The two findings (F1 `coproc`, F2 stdin fed from outside the call) are filed as open. I confirmed F1: `coproc git -C /tmp/other fast-import` is allowed.

## Notes
- (security) packages/core/src/bash-refusal.ts:129: `coproc` feeds fast-import's stdin unseen. `coproc git -C /tmp/other fast-import` passes the guard; this is already filed as F1 in the ticket's findings.md.
- (minor) packages/core/src/bash-refusal.ts:40: the `fed` regex also matches `|` or `<` inside quoted text, so an unrelated quoted pipe refuses a fast-import. It errs toward refusing, which is safe.

## Checks (commit 0c600231)
- `npm run check`: tsc clean.
- `npm test`: 1582 tests, 1518 pass, 0 fail, 0 cancelled, 64 skipped. The structure test prints `bash-refusal.ts: 212 lines, yellow`.
- `npm run mutate`: did not finish; it was still running when the 1800 s timeout stopped it, so it gave no result. I did the two hand mutations above instead.
- Direct `bashRefusal` probes: 9 commands, with the results described above.

PASS