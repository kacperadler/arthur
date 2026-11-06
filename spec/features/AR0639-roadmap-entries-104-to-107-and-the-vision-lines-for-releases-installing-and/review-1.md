# AR0639 - Review 1

- Job: 2026-11-06-review-b808ae76
- Branch: arthur/2026-11-06-worker-d03737be
- Commit reviewed: 26267c4c63058dc79a6c47294261516ad688dfb9
- Verdict: PASS

## Final message

No finding blocks the merge. The diff writes the approved AR0128 plan into the roadmap and the vision as the ticket asks, and changes no code.

- **Entries 104 to 107** (`spec/roadmap.md:916-952`, new `## Releases` section before `## Later`): each one's packages, dependencies and size match plan section 7:
  - 104 depends on 21, 30 and 80; half a day.
  - 105 depends on 56 and 104; half a day to a day.
  - 106 depends on 37, 104 and 105; a day.
  - 107 depends on 39 and 106; half a day.

  Each Delivers line names its plan section: 1 and 4, 2 and 6, 3 and 5, and the notice in 5. The Delivers and Done means text matches what the plan says, including the edge cases.
- **No number collisions:** 103 is the highest earlier entry, and nothing else uses 104 to 107.
- **Entry 30** (`spec/roadmap.md:310`): the machine fix now names `arthur machines update` from entry 106 instead of `npm i -g arthur`. A search for `npm i\b|npm install|-g arthur|from npm|on npm|arthur@` in `spec/roadmap.md`, `README.md`, `docs/` and `spec/vision.md` finds no line telling a reader to install Arthur from npm. The only hits say "not on npm".
- **Vision** (`spec/vision.md:176`): one line under "How it is built" covers every point the ticket asks for:
  - one version for the core and every plugin;
  - a Git tag `v<version>` and a GitHub release, not on npm;
  - first release 0.1.0;
  - installed from a clone at the newest tag;
  - updated with `arthur update`.
- **findings.md F1:** the worker found a code comment that still mentions an npm install and filed it as a finding instead of editing it. That is correct, since the ticket's Scope leaves out all code. I confirmed the comment is at `packages/core/src/job-place.ts:21`.
- The worker's claims match the diff: one commit, three files.

## Notes
- (minor) spec/roadmap.md:21: The header says releases "close the first version, after Docker (70 to 72)". The AR0128 plan does not say where releases go in the order, so this placement is the worker's own reading. It doesn't contradict the plan.
- (minor) packages/core/src/job-place.ts:21: Outside this range. The comment still says "`node_modules` of an install from npm". It is already filed as F1 for entry 106's ticket.

## Checks
- `npm test` in `site/` on 26267c4c: 36 tests, 36 pass, 0 fail. These include the roadmap page parser's tests for duplicate entry numbers and sections.
- Grep for npm install wording, and a check that the new entry numbers don't collide: results above.
- As instructed, I did not rerun `npm run check`, `npm test` at the repo root or `npm run mutate`. The worker reports both checks passing on 26267c4c (1583 tests run, 1519 pass, 0 fail, 64 skipped) and 0 mutants, which is expected for a docs-only change.
- I did not regenerate the roadmap page myself. The claim that the existing counts are unchanged and the new entries show as not started is the worker's.

PASS