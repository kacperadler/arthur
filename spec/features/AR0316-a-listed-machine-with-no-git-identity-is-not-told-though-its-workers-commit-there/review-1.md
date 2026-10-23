# AR0316 - Review 1

- Job: 2026-10-23-review-ar0316-dd70c2ac
- Branch: h/2026-10-23-ar0316-15daeb35
- Commit reviewed: 503300ae46dc11deaa2e66643d2b46f719d25b1d
- Verdict: PASS

## Final message

## Findings

None blocking.

## Notes

- `costs` message is a fixed phrase (`git has no author there`) even when only the committer identity is missing (e.g. the `committer-box` test case). This mirrors `delivery`'s own existing `costs` wording (`merge-command.ts:123`, also fixed regardless of which variable fails), so it follows the ticket's "same fix wording as `delivery <project> identity`" instruction rather than being a new inconsistency.
- Worker's claim about running the loop with no `git` on PATH (printing `/bin/sh: 1: git: not found`) is unverified by me; it's consistent with the documented F1 finding (exit 127 not specially handled), which is correctly filed as an open finding rather than silently left unhandled.

## Checks run

- `npm ci`: clean, 22 packages.
- `npm run check` (tsc): clean, no errors.
- `npm test`: 1050/1050 pass, 0 fail — matches worker's claim exactly.
- `node --test packages/machines/test/machines.test.ts`: 19/19 pass.
- `wc -l packages/machines/src/*.ts` → 484 total; `git diff --numstat` → `machine-check.ts` +9−5, `machines.ts` +10−9 — matches worker's claim and the ticket's accepted budget decision (479→484).
- Mutation 1: dropped `GIT_COMMITTER_IDENT` from the `IDENTITY` loop in `machine-check.ts` → `machines.test.ts` fails (committer-box case now reports `ok` instead of missing). Restored, confirmed `git status --short` clean.
- Mutation 2: forced `online().identity && identity` to `false && identity` in the `either` helper (`machines.ts:102`), dropping the identity part from doctor lines → test fails (all three cases lose their identity wording). Restored, confirmed clean.
- Verified `identity` is read only inside the doctor `check`/`costs`/`fix` getters, never inside placement (`machine-place.ts` untouched, no `identity` references), matching the ticket's "placement stays by labels" requirement; corroborated by the added placement test (`build-box` with no identity still placed).
- Grep for `class`/`enum` in changed files: none. `package.json` `dependencies`: empty/absent — styleguide Shape rules hold.
- Diff confined to `packages/machines/{src,docs,test}`, `test/structure.test.ts`, and the ticket's own `findings.md` — no boundary violations, no other-package or core-by-path imports.

PASS
